import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Chain } from '../types';

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getBalance: vi.fn(),
    readContract: vi.fn(),
  })),
  http: vi.fn(),
  erc20Abi: [],
}));

// Mock viem chains
vi.mock('viem/chains', () => ({
  mainnet: { id: 1 },
  arbitrum: { id: 42161 },
  optimism: { id: 10 },
  base: { id: 8453 },
  polygon: { id: 137 },
  bsc: { id: 56 },
  avalanche: { id: 43114 },
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}));

// Mock httpUtils
vi.mock('../../utils/httpUtils', () => ({
  httpWithRetry: vi.fn((fn: () => Promise<any>) => fn()),
  HttpError: class HttpError {
    type: string;
    retryAfter: number;
    constructor(_message: string, type: string) {
      this.type = type;
      this.retryAfter = 60;
    }
  },
  HttpErrorType: {
    RATE_LIMIT: 'RATE_LIMIT',
    NETWORK: 'NETWORK',
  },
}));

// Mock chains config
vi.mock('../chains', () => ({
  CHAIN_CONFIGS: {
    [Chain.ETHEREUM]: {
      isEVM: true,
      rpcUrls: ['https://eth.example.com'],
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
      blockExplorer: { apiUrl: 'https://api.etherscan.io' },
    },
    [Chain.POLYGON]: {
      isEVM: true,
      rpcUrls: ['https://polygon.example.com'],
      nativeCurrency: { symbol: 'MATIC', decimals: 18 },
      blockExplorer: { apiUrl: 'https://api.polygonscan.com' },
    },
    [Chain.SOLANA]: {
      isEVM: false,
    },
  },
  COMMON_TOKENS: {
    [Chain.ETHEREUM]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      DAI: '0x6B175474E89094C44Da98b954EesdedfE4F72696F',
    },
    [Chain.POLYGON]: {
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    },
  },
}));

// Mock token registry
vi.mock('../TokenRegistry', () => ({
  tokenRegistry: {
    filterRegisteredTokens: vi.fn(() => ({ registered: [], unregistered: [] })),
    isRegisteredToken: vi.fn(() => true),
    loadTokenList: vi.fn(),
  },
}));

import { createPublicClient } from 'viem';
import axios from 'axios';
import { EVMProvider } from '../EVMProvider';

describe('EVMProvider', () => {
  let provider: EVMProvider;
  let mockViemClient: any;
  let mockAxiosClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup viem mock
    mockViemClient = {
      getBalance: vi.fn(),
      readContract: vi.fn(),
    };
    (createPublicClient as any).mockReturnValue(mockViemClient);

    // Setup axios mock
    mockAxiosClient = {
      get: vi.fn(),
    };
    (axios.create as any).mockReturnValue(mockAxiosClient);

    provider = new EVMProvider(Chain.ETHEREUM, 'test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create provider for EVM chain', () => {
      expect(provider).toBeDefined();
    });

    it('should throw for non-EVM chain', () => {
      expect(() => new EVMProvider(Chain.SOLANA)).toThrow('is not an EVM chain');
    });
  });

  describe('getNativeBalance', () => {
    it('should return native balance for valid address', async () => {
      const mockBalance = BigInt('1500000000000000000'); // 1.5 ETH
      mockViemClient.getBalance.mockResolvedValue(mockBalance);

      const result = await provider.getNativeBalance('0x1234567890abcdef1234567890abcdef12345678');

      expect(result.chain).toBe(Chain.ETHEREUM);
      expect(result.symbol).toBe('ETH');
      expect(result.balance.toNumber()).toBe(1.5);
      expect(result.balanceRaw).toBe('1500000000000000000');
    });

    it('should return zero balance on error', async () => {
      mockViemClient.getBalance.mockRejectedValue(new Error('RPC error'));

      const result = await provider.getNativeBalance('0x1234567890abcdef1234567890abcdef12345678');

      expect(result.balance.toNumber()).toBe(0);
      expect(result.balanceRaw).toBe('0');
    });

    it('should handle different chains', async () => {
      const polygonProvider = new EVMProvider(Chain.POLYGON);
      const mockBalance = BigInt('2000000000000000000');
      mockViemClient.getBalance.mockResolvedValue(mockBalance);

      const result = await polygonProvider.getNativeBalance('0x1234567890abcdef1234567890abcdef12345678');

      expect(result.chain).toBe(Chain.POLYGON);
      expect(result.symbol).toBe('MATIC');
    });
  });

  describe('getTokenBalance', () => {
    const testAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    it('should return token balance', async () => {
      const mockBalance = BigInt('1000000000'); // 1000 USDC (6 decimals)
      mockViemClient.readContract.mockResolvedValueOnce(mockBalance); // balanceOf
      mockViemClient.readContract.mockResolvedValueOnce(6); // decimals
      mockViemClient.readContract.mockResolvedValueOnce('USDC'); // symbol
      mockViemClient.readContract.mockResolvedValueOnce('USD Coin'); // name
      mockViemClient.readContract.mockResolvedValueOnce(6); // decimals again

      const result = await provider.getTokenBalance(testAddress, usdcAddress);

      expect(result).not.toBeNull();
      expect(result!.balance.toNumber()).toBe(1000);
      expect(result!.token.symbol).toBe('USDC');
    });

    it('should return null for zero balance', async () => {
      mockViemClient.readContract.mockResolvedValueOnce(0n);

      const result = await provider.getTokenBalance(testAddress, usdcAddress);

      expect(result).toBeNull();
    });

    it('should return null on contract error', async () => {
      mockViemClient.readContract.mockRejectedValue(new Error('Contract not found'));

      const result = await provider.getTokenBalance(testAddress, usdcAddress);

      expect(result).toBeNull();
    });
  });

  describe('getAllTokenBalances', () => {
    const testAddress = '0x1234567890abcdef1234567890abcdef12345678';

    it('should return token balances from explorer API', async () => {
      // Mock explorer API response
      mockAxiosClient.get.mockResolvedValueOnce({
        data: {
          status: '1',
          result: [
            {
              contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              tokenSymbol: 'USDC',
              tokenName: 'USD Coin',
              tokenDecimal: '6',
              value: '1000000000',
              from: '0x0000',
              to: testAddress,
              hash: '0xabc123',
            },
          ],
        },
      });

      // Mock token balance fetch
      const mockBalance = BigInt('500000000'); // 500 USDC
      mockViemClient.readContract.mockResolvedValue(mockBalance);

      const result = await provider.getAllTokenBalances(testAddress);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should fallback to common tokens on API error', async () => {
      mockAxiosClient.get.mockRejectedValue(new Error('API error'));

      // Mock common token balances
      mockViemClient.readContract.mockResolvedValue(BigInt('0'));

      const result = await provider.getAllTokenBalances(testAddress);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle no token transactions', async () => {
      mockAxiosClient.get.mockResolvedValueOnce({
        data: {
          status: '0',
          result: [],
        },
      });

      mockViemClient.readContract.mockResolvedValue(BigInt('0'));

      const result = await provider.getAllTokenBalances(testAddress);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getTransactionHistory', () => {
    const testAddress = '0x1234567890abcdef1234567890abcdef12345678';

    it('should return transaction history', async () => {
      // Mock normal transactions
      mockAxiosClient.get.mockResolvedValueOnce({
        data: {
          status: '1',
          result: [
            {
              blockNumber: '12345678',
              timeStamp: '1704067200',
              hash: '0xabc123',
              from: testAddress,
              to: '0xdef456',
              value: '1000000000000000000',
              gas: '21000',
              gasPrice: '20000000000',
              gasUsed: '21000',
              isError: '0',
              txreceipt_status: '1',
              functionName: '',
            },
          ],
        },
      });

      // Mock token transactions
      mockAxiosClient.get.mockResolvedValueOnce({
        data: {
          status: '0',
          result: [],
        },
      });

      const result = await provider.getTransactionHistory(testAddress, 10);

      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('0xabc123');
      expect(result[0].chain).toBe(Chain.ETHEREUM);
      expect(result[0].value.toNumber()).toBe(1);
      expect(result[0].status).toBe('success');
    });

    it('should infer transaction types correctly', async () => {
      mockAxiosClient.get.mockResolvedValueOnce({
        data: {
          status: '1',
          result: [
            {
              blockNumber: '12345678',
              timeStamp: '1704067200',
              hash: '0xswap123',
              from: testAddress,
              to: '0xdef456',
              value: '0',
              gas: '200000',
              gasPrice: '20000000000',
              gasUsed: '150000',
              isError: '0',
              txreceipt_status: '1',
              functionName: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
            },
          ],
        },
      });

      mockAxiosClient.get.mockResolvedValueOnce({
        data: { status: '0', result: [] },
      });

      const result = await provider.getTransactionHistory(testAddress, 10);

      expect(result[0].type).toBe('swap');
    });

    it('should handle failed transactions', async () => {
      mockAxiosClient.get.mockResolvedValueOnce({
        data: {
          status: '1',
          result: [
            {
              blockNumber: '12345678',
              timeStamp: '1704067200',
              hash: '0xfailed',
              from: testAddress,
              to: '0xdef456',
              value: '0',
              gas: '21000',
              gasPrice: '20000000000',
              gasUsed: '21000',
              isError: '1', // Failed transaction
              txreceipt_status: '0',
              functionName: '',
            },
          ],
        },
      });

      mockAxiosClient.get.mockResolvedValueOnce({
        data: { status: '0', result: [] },
      });

      const result = await provider.getTransactionHistory(testAddress, 10);

      expect(result[0].status).toBe('failed');
    });

    it('should include token transfers in transactions', async () => {
      const txHash = '0xwithtokens';

      mockAxiosClient.get.mockResolvedValueOnce({
        data: {
          status: '1',
          result: [
            {
              blockNumber: '12345678',
              timeStamp: '1704067200',
              hash: txHash,
              from: testAddress,
              to: '0xdef456',
              value: '0',
              gas: '100000',
              gasPrice: '20000000000',
              gasUsed: '75000',
              isError: '0',
              txreceipt_status: '1',
              functionName: 'transfer(address,uint256)',
            },
          ],
        },
      });

      mockAxiosClient.get.mockResolvedValueOnce({
        data: {
          status: '1',
          result: [
            {
              blockNumber: '12345678',
              timeStamp: '1704067200',
              hash: txHash,
              from: testAddress,
              to: '0xrecipient',
              value: '1000000000',
              tokenName: 'USD Coin',
              tokenSymbol: 'USDC',
              tokenDecimal: '6',
              contractAddress: '0xusdc',
              gas: '100000',
              gasPrice: '20000000000',
              gasUsed: '75000',
            },
          ],
        },
      });

      const result = await provider.getTransactionHistory(testAddress, 10);

      expect(result[0].tokenTransfers).toHaveLength(1);
      expect(result[0].tokenTransfers[0].token.symbol).toBe('USDC');
      expect(result[0].tokenTransfers[0].amount.toNumber()).toBe(1000);
    });

    it('should return empty array on error', async () => {
      mockAxiosClient.get.mockRejectedValue(new Error('Network error'));

      const result = await provider.getTransactionHistory(testAddress, 10);

      expect(result).toHaveLength(0);
    });
  });

  describe('isTokenRegistered', () => {
    it('should check token registry', async () => {
      const { tokenRegistry } = await import('../TokenRegistry');

      await provider.isTokenRegistered('0xtoken');

      expect(tokenRegistry.isRegisteredToken).toHaveBeenCalledWith('0xtoken', Chain.ETHEREUM);
    });
  });

  describe('rate limiting', () => {
    it('should rate limit API calls', async () => {
      const startTime = Date.now();

      mockAxiosClient.get.mockResolvedValue({
        data: { status: '0', result: [] },
      });

      // Make two rapid calls
      await provider.getAllTokenBalances('0x1234');
      await provider.getAllTokenBalances('0x1234');

      // The second call should have been delayed
      const elapsed = Date.now() - startTime;
      // Should take at least 250ms due to rate limiting
      expect(elapsed).toBeGreaterThanOrEqual(200);
    });
  });
});
