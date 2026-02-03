import { app, BrowserWindow, ipcMain, safeStorage, net } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SafeStorageService } from './services/safeStorage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Must be defined early for use in audit functions
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

// Simple rate limiter for IPC channels
class IpcRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(channel: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(channel) || [];

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(channel, validTimestamps);
    return true;
  }

  getRemainingRequests(channel: string): number {
    const now = Date.now();
    const timestamps = this.requests.get(channel) || [];
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - validTimestamps.length);
  }
}

// Rate limiter configuration per channel
const rateLimiters: Record<string, IpcRateLimiter> = {
  'net:request': new IpcRateLimiter(60000, 120),  // 120 requests per minute for network
  'safeStorage:encrypt': new IpcRateLimiter(60000, 30),  // 30 per minute for storage ops
  'safeStorage:decrypt': new IpcRateLimiter(60000, 60),
  'safeStorage:delete': new IpcRateLimiter(60000, 20),
  'safeStorage:list': new IpcRateLimiter(60000, 30),
};

// Audit logger for security-sensitive operations
function auditLog(channel: string, action: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = details ? sanitizeLogDetails(details) : {};

  // In production, this could write to a secure audit log
  if (!isDev) {
    console.log(JSON.stringify({
      timestamp,
      type: 'audit',
      channel,
      action,
      ...sanitizedDetails,
    }));
  }
}

// Remove sensitive data from log details
function sanitizeLogDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['apiKey', 'apiSecret', 'passphrase', 'password', 'secret', 'token', 'key'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Sanitize error messages to remove sensitive data
function sanitizeErrorMessage(message: string): string {
  // Remove potential API keys (alphanumeric strings 20+ chars)
  let sanitized = message.replace(/[a-zA-Z0-9]{20,}/g, '[REDACTED]');
  // Remove potential secrets in key=value format
  sanitized = sanitized.replace(/(api[_-]?key|secret|password|token)\s*[=:]\s*\S+/gi, '$1=[REDACTED]');
  return sanitized;
}

// URL whitelist for net:request - only allow known exchange/crypto API endpoints
const ALLOWED_URL_PATTERNS = [
  // Major exchanges
  /^https:\/\/api\.binance\.com\//,
  /^https:\/\/.*\.binance\.com\/api\//,
  /^https:\/\/api\.bybit\.com\//,
  /^https:\/\/api\.okx\.com\//,
  /^https:\/\/api\.kraken\.com\//,
  /^https:\/\/api\.coinbase\.com\//,
  /^https:\/\/api\.upbit\.com\//,
  /^https:\/\/api\.bithumb\.com\//,
  /^https:\/\/api\.gate\.io\//,
  /^https:\/\/api\.htx\.com\//,
  /^https:\/\/api\.bitget\.com\//,
  /^https:\/\/open-api\.bingx\.com\//,
  /^https:\/\/api\.lbank\.com\//,
  /^https:\/\/api\.woo\.org\//,
  /^https:\/\/api\.coinone\.co\.kr\//,
  // DEX/Perp protocols
  /^https:\/\/api\.hyperliquid\.xyz\//,
  /^https:\/\/api\.dydx\.exchange\//,
  /^https:\/\/indexer\.dydx\.trade\//,
  // Blockchain/DeFi APIs
  /^https:\/\/.*\.infura\.io\//,
  /^https:\/\/.*\.alchemy\.com\//,
  /^https:\/\/api\.etherscan\.io\//,
  /^https:\/\/api\.zapper\.xyz\//,
  /^https:\/\/public\.zapper\.xyz\//,
  /^https:\/\/api\.coingecko\.com\//,
  /^https:\/\/pro-api\.coinmarketcap\.com\//,
  // Solana
  /^https:\/\/api\.mainnet-beta\.solana\.com\//,
  /^https:\/\/.*\.helius-rpc\.com\//,
  // Sui
  /^https:\/\/fullnode\.mainnet\.sui\.io\//,
  /^https:\/\/.*\.suifrens\.sui\.io\//,
];

// Maximum request body size (1MB)
const MAX_REQUEST_BODY_SIZE = 1024 * 1024;

// Validate URL against whitelist
function isUrlAllowed(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Must be HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    // Check against whitelist
    return ALLOWED_URL_PATTERNS.some(pattern => pattern.test(url));
  } catch {
    return false;
  }
}

let mainWindow: BrowserWindow | null = null;
let safeStorageService: SafeStorageService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: !isDev, // Disable sandbox in dev for network access
      webSecurity: !isDev, // Disable CORS in dev mode
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#18181b',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  safeStorageService = new SafeStorageService();

  // Helper to check rate limit for a channel
  const checkRateLimit = (channel: string): void => {
    const limiter = rateLimiters[channel];
    if (limiter && !limiter.isAllowed(channel)) {
      throw new Error(`Rate limit exceeded for ${channel}. Please wait and try again.`);
    }
  };

  // Safe Storage handlers with rate limiting and audit logging
  ipcMain.handle('safeStorage:isAvailable', () => {
    return safeStorage.isEncryptionAvailable();
  });

  ipcMain.handle('safeStorage:encrypt', async (_event, key: string, value: string) => {
    checkRateLimit('safeStorage:encrypt');
    auditLog('safeStorage:encrypt', 'store', { key });
    return safeStorageService.store(key, value);
  });

  ipcMain.handle('safeStorage:decrypt', async (_event, key: string) => {
    checkRateLimit('safeStorage:decrypt');
    auditLog('safeStorage:decrypt', 'retrieve', { key });
    return safeStorageService.retrieve(key);
  });

  ipcMain.handle('safeStorage:delete', async (_event, key: string) => {
    checkRateLimit('safeStorage:delete');
    auditLog('safeStorage:delete', 'delete', { key });
    return safeStorageService.delete(key);
  });

  ipcMain.handle('safeStorage:list', async () => {
    checkRateLimit('safeStorage:list');
    auditLog('safeStorage:list', 'list');
    return safeStorageService.listKeys();
  });

  // App info handlers
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  ipcMain.handle('app:getPath', (_event, name: string) => {
    return app.getPath(name as 'home' | 'appData' | 'userData' | 'temp' | 'exe' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'logs');
  });

  // Network request handler - bypasses CORS by making requests from main process
  ipcMain.handle('net:request', async (_event, options: HttpRequestOptions) => {
    // Check rate limit
    checkRateLimit('net:request');

    // Validate URL against whitelist
    if (!isUrlAllowed(options.url)) {
      auditLog('net:request', 'blocked', { url: options.url, reason: 'not_whitelisted' });
      return Promise.reject(new Error('URL not allowed. Only requests to known exchange/crypto APIs are permitted.'));
    }

    // Validate request body size
    if (options.body && options.body.length > MAX_REQUEST_BODY_SIZE) {
      auditLog('net:request', 'blocked', { url: options.url, reason: 'body_too_large', size: options.body.length });
      return Promise.reject(new Error(`Request body too large. Maximum allowed: ${MAX_REQUEST_BODY_SIZE} bytes.`));
    }

    // Log the request (URL host only, not full URL to avoid leaking paths)
    const urlHost = new URL(options.url).host;
    auditLog('net:request', 'request', { host: urlHost, method: options.method || 'GET' });

    return new Promise((resolve, reject) => {
      const request = net.request({
        url: options.url,
        method: options.method || 'GET',
      });

      // Set headers
      if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          request.setHeader(key, value);
        }
      }

      // Set timeout
      const timeoutMs = options.timeout || 30000;
      const timeout = setTimeout(() => {
        request.abort();
        reject(new Error('Request timeout'));
      }, timeoutMs);

      let responseData = '';
      let responseHeaders: Record<string, string> = {};
      let statusCode = 0;
      let statusMessage = '';

      request.on('response', (response) => {
        statusCode = response.statusCode;
        statusMessage = response.statusMessage || '';

        // Collect headers
        response.headers && Object.entries(response.headers).forEach(([key, value]) => {
          responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
        });

        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          clearTimeout(timeout);
          try {
            const data = responseData ? JSON.parse(responseData) : null;
            resolve({
              status: statusCode,
              statusText: statusMessage,
              data,
              headers: responseHeaders,
            });
          } catch {
            // If JSON parsing fails, return raw data
            resolve({
              status: statusCode,
              statusText: statusMessage,
              data: responseData,
              headers: responseHeaders,
            });
          }
        });

        response.on('error', (error) => {
          clearTimeout(timeout);
          // Sanitize error message to prevent credential leakage
          const sanitizedMessage = sanitizeErrorMessage(error.message);
          reject(new Error(sanitizedMessage));
        });
      });

      request.on('error', (error) => {
        clearTimeout(timeout);
        // Sanitize error message to prevent credential leakage
        const sanitizedMessage = sanitizeErrorMessage(error.message);
        reject(new Error(sanitizedMessage));
      });

      // Send body if present
      if (options.body) {
        request.write(options.body);
      }

      request.end();
    });
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Set Content Security Policy for production builds
  if (!isDev) {
    contents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              // Default to same origin
              "default-src 'self'",
              // Allow scripts from self and inline (React requires this)
              "script-src 'self' 'unsafe-inline'",
              // Allow styles from self, inline, and data URIs (for Tailwind)
              "style-src 'self' 'unsafe-inline'",
              // Allow images from self, data URIs, and HTTPS sources
              "img-src 'self' data: https:",
              // Allow fonts from self
              "font-src 'self' data:",
              // Allow connections to APIs and WebSockets
              "connect-src 'self' https: wss:",
              // Prevent embedding in iframes (clickjacking protection)
              "frame-ancestors 'none'",
              // Form action restriction
              "form-action 'self'",
              // Base URI restriction
              "base-uri 'self'",
            ].join('; '),
          ],
        },
      });
    });
  }
});
