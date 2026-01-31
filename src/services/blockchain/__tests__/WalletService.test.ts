import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';

// Mock EVMProvider methods
const mockEVMProviderMethods = {
  getNativeBalance: vi.fn(),
  getCommonTokenBalances: vi.fn(),
  getAllTokenBalances: vi.fn(),
  getTransactionHistory: vi.fn(),
};

// Mock SolanaProvider methods
const mockSolanaProviderMethods = {
  getNativeBalance: vi.fn(),
  getTokenBalances: vi.fn(),
  isValidAddress: vi.fn(),
};

// Mock PriceService
vi.mock('../../price', () => ({
  priceService: {
    getPrices: vi.fn().mockResolvedValue(new Map()),
  },
}));

// Mock EVMProvider as a class
vi.mock('../EVMProvider', () => ({
  EVMProvider: class MockEVMProvider {
    getNativeBalance = mockEVMProviderMethods.getNativeBalance;
    getCommonTokenBalances = mockEVMProviderMethods.getCommonTokenBalances;
    getAllTokenBalances = mockEVMProviderMethods.getAllTokenBalances;
    getTransactionHistory = mockEVMProviderMethods.getTransactionHistory;
  },
}));

// Mock SolanaProvider as a class
vi.mock('../SolanaProvider', () => ({
  SolanaProvider: class MockSolanaProvider {
    getNativeBalance = mockSolanaProviderMethods.getNativeBalance;
    getTokenBalances = mockSolanaProviderMethods.getTokenBalances;
    isValidAddress = mockSolanaProviderMethods.isValidAddress;
  },
}));

vi.mock('../chains', () => ({
  CHAIN_CONFIGS: {
    ethereum: { id: 'ethereum', isEVM: true, nativeCurrency: { symbol: 'ETH' } },
    polygon: { id: 'polygon', isEVM: true, nativeCurrency: { symbol: 'MATIC' } },
    solana: { id: 'solana', isEVM: false, nativeCurrency: { symbol: 'SOL' } },
  },
  getEVMChains: vi.fn(() => [
    { id: 'ethereum', isEVM: true },
    { id: 'polygon', isEVM: true },
  ]),
}));

import { Chain } from '../types';

describe('WalletService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSolanaProviderMethods.isValidAddress.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('address validation', () => {
    it('should validate EVM addresses correctly', async () => {
      // Valid EVM addresses
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123',
        '0x0000000000000000000000000000000000000000',
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ];

      // Import dynamically to get fresh instance
      const { walletService } = await import('../WalletService');

      for (const addr of validAddresses) {
        expect(walletService.isValidEVMAddress(addr)).toBe(true);
      }
    });

    it('should reject invalid EVM addresses', async () => {
      const invalidAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E12', // Too short
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E1234', // Too long
        '742d35Cc6634C0532925a3b844Bc9e7595f1E123', // Missing 0x
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid hex
        '', // Empty
        'not-an-address',
      ];

      const { walletService } = await import('../WalletService');

      for (const addr of invalidAddresses) {
        expect(walletService.isValidEVMAddress(addr)).toBe(false);
      }
    });

    it('should validate Solana addresses correctly', async () => {
      mockSolanaProviderMethods.isValidAddress.mockReturnValue(true);

      const { walletService } = await import('../WalletService');
      expect(walletService.isValidSolanaAddress('SomeValidSolanaAddress')).toBe(true);
      expect(mockSolanaProviderMethods.isValidAddress).toHaveBeenCalled();
    });

    it('should use correct validator for chain type', async () => {
      const { walletService } = await import('../WalletService');

      // EVM chain should use EVM validator
      const evmAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123';
      expect(walletService.isValidAddress(evmAddress, Chain.ETHEREUM)).toBe(true);

      // Solana chain should use Solana validator
      mockSolanaProviderMethods.isValidAddress.mockReturnValue(true);
      expect(walletService.isValidAddress('SolanaAddress', Chain.SOLANA)).toBe(true);
    });
  });

  describe('getNativeBalance', () => {
    it('should fetch native balance for EVM chain', async () => {
      const mockBalance = {
        chain: Chain.ETHEREUM,
        walletAddress: '0x123',
        symbol: 'ETH',
        balance: new Decimal(1.5),
        balanceRaw: '1500000000000000000',
      };
      mockEVMProviderMethods.getNativeBalance.mockResolvedValue(mockBalance);

      const { walletService } = await import('../WalletService');
      const result = await walletService.getNativeBalance(
        Chain.ETHEREUM,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123'
      );

      expect(result).toEqual(mockBalance);
    });

    it('should fetch native balance for Solana', async () => {
      const mockBalance = {
        chain: Chain.SOLANA,
        walletAddress: 'SolanaAddr',
        symbol: 'SOL',
        balance: new Decimal(10),
        balanceRaw: '10000000000',
      };
      mockSolanaProviderMethods.getNativeBalance.mockResolvedValue(mockBalance);

      const { walletService } = await import('../WalletService');
      const result = await walletService.getNativeBalance(Chain.SOLANA, 'SolanaAddr');

      expect(result).toEqual(mockBalance);
    });

    it('should return null on error', async () => {
      mockEVMProviderMethods.getNativeBalance.mockRejectedValue(new Error('RPC error'));

      const { walletService } = await import('../WalletService');
      const result = await walletService.getNativeBalance(
        Chain.ETHEREUM,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123'
      );

      expect(result).toBeNull();
    });
  });

  describe('getTokenBalances', () => {
    it('should fetch token balances with common tokens only', async () => {
      const mockTokens = [
        { token: { symbol: 'USDC' }, balance: new Decimal(1000) },
      ];
      mockEVMProviderMethods.getCommonTokenBalances.mockResolvedValue(mockTokens);

      const { walletService } = await import('../WalletService');
      const result = await walletService.getTokenBalances(
        Chain.ETHEREUM,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123',
        { useCommonOnly: true }
      );

      expect(result).toEqual(mockTokens);
      expect(mockEVMProviderMethods.getCommonTokenBalances).toHaveBeenCalled();
    });

    it('should fetch all token balances when useCommonOnly is false', async () => {
      const mockTokens = [
        { token: { symbol: 'USDC' }, balance: new Decimal(1000) },
        { token: { symbol: 'WETH' }, balance: new Decimal(2) },
      ];
      mockEVMProviderMethods.getAllTokenBalances.mockResolvedValue(mockTokens);

      const { walletService } = await import('../WalletService');
      const result = await walletService.getTokenBalances(
        Chain.ETHEREUM,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123',
        { useCommonOnly: false }
      );

      expect(result).toEqual(mockTokens);
      expect(mockEVMProviderMethods.getAllTokenBalances).toHaveBeenCalled();
    });

    it('should fetch Solana token balances', async () => {
      const mockTokens = [
        { token: { symbol: 'USDC' }, balance: new Decimal(500) },
      ];
      mockSolanaProviderMethods.getTokenBalances.mockResolvedValue(mockTokens);

      const { walletService } = await import('../WalletService');
      const result = await walletService.getTokenBalances(Chain.SOLANA, 'SolanaAddr');

      expect(result).toEqual(mockTokens);
      expect(mockSolanaProviderMethods.getTokenBalances).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      mockEVMProviderMethods.getAllTokenBalances.mockRejectedValue(new Error('API error'));

      const { walletService } = await import('../WalletService');
      const result = await walletService.getTokenBalances(
        Chain.ETHEREUM,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123'
      );

      expect(result).toEqual([]);
    });
  });

  describe('getTransactionHistory', () => {
    it('should fetch transaction history', async () => {
      const mockTxs = [
        { hash: '0x123', from: '0xabc', to: '0xdef', value: new Decimal(1) },
      ];
      mockEVMProviderMethods.getTransactionHistory.mockResolvedValue(mockTxs);

      const { walletService } = await import('../WalletService');
      const result = await walletService.getTransactionHistory(
        Chain.ETHEREUM,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123',
        50
      );

      expect(result).toEqual(mockTxs);
      expect(mockEVMProviderMethods.getTransactionHistory).toHaveBeenCalledWith(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123',
        50
      );
    });

    it('should return empty array on error', async () => {
      mockEVMProviderMethods.getTransactionHistory.mockRejectedValue(new Error('API error'));

      const { walletService } = await import('../WalletService');
      const result = await walletService.getTransactionHistory(
        Chain.ETHEREUM,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f1E123'
      );

      expect(result).toEqual([]);
    });
  });

  describe('getSupportedChains', () => {
    it('should return list of supported chains including Solana', async () => {
      const { walletService } = await import('../WalletService');
      const chains = walletService.getSupportedChains();

      expect(chains).toContain(Chain.SOLANA);
      expect(chains.length).toBeGreaterThan(0);
    });
  });

  describe('setApiKey', () => {
    it('should set API key for a chain', async () => {
      const { walletService } = await import('../WalletService');

      // Should not throw
      expect(() => {
        walletService.setApiKey(Chain.ETHEREUM, 'test-api-key');
      }).not.toThrow();
    });
  });
});
