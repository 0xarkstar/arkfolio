import { app, BrowserWindow, ipcMain, safeStorage, net } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SafeStorageService } from './services/safeStorage';

interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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

  // Safe Storage handlers
  ipcMain.handle('safeStorage:isAvailable', () => {
    return safeStorage.isEncryptionAvailable();
  });

  ipcMain.handle('safeStorage:encrypt', async (_event, key: string, value: string) => {
    return safeStorageService.store(key, value);
  });

  ipcMain.handle('safeStorage:decrypt', async (_event, key: string) => {
    return safeStorageService.retrieve(key);
  });

  ipcMain.handle('safeStorage:delete', async (_event, key: string) => {
    return safeStorageService.delete(key);
  });

  ipcMain.handle('safeStorage:list', async () => {
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
    return app.getPath(name as any);
  });

  // Network request handler - bypasses CORS by making requests from main process
  ipcMain.handle('net:request', async (_event, options: HttpRequestOptions) => {
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
          reject(error);
        });
      });

      request.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
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
