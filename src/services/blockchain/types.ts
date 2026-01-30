import Decimal from 'decimal.js';

// Supported chains
export enum Chain {
  ETHEREUM = 'ethereum',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
  BASE = 'base',
  POLYGON = 'polygon',
  BSC = 'bsc',
  AVALANCHE = 'avalanche',
  SOLANA = 'solana',
}

// Chain configuration
export interface ChainConfig {
  id: Chain;
  name: string;
  chainId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorer: {
    name: string;
    url: string;
    apiUrl: string;
  };
  isEVM: boolean;
}

// Token information
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

// Token balance
export interface TokenBalance {
  chain: Chain;
  walletAddress: string;
  token: TokenInfo;
  balance: Decimal;
  balanceRaw: string;
  valueUsd?: Decimal;
}

// Native balance (ETH, MATIC, etc.)
export interface NativeBalance {
  chain: Chain;
  walletAddress: string;
  symbol: string;
  balance: Decimal;
  balanceRaw: string;
  valueUsd?: Decimal;
}

// NFT information
export interface NFTInfo {
  chain: Chain;
  walletAddress: string;
  contractAddress: string;
  tokenId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  collectionName?: string;
  standard: 'ERC721' | 'ERC1155';
  amount: number; // 1 for ERC721, can be > 1 for ERC1155
}

// Transaction types
export type TransactionType =
  | 'transfer'
  | 'swap'
  | 'approve'
  | 'mint'
  | 'burn'
  | 'stake'
  | 'unstake'
  | 'claim'
  | 'bridge'
  | 'contract_interaction'
  | 'unknown';

// On-chain transaction
export interface OnchainTransaction {
  chain: Chain;
  hash: string;
  blockNumber: number;
  timestamp: Date;
  from: string;
  to: string;
  value: Decimal;
  gasUsed: Decimal;
  gasPrice: Decimal;
  fee: Decimal;
  status: 'success' | 'failed' | 'pending';
  type: TransactionType;
  tokenTransfers: TokenTransfer[];
}

// Token transfer within a transaction
export interface TokenTransfer {
  token: TokenInfo;
  from: string;
  to: string;
  amount: Decimal;
  amountRaw: string;
}

// Wallet summary across chains
export interface WalletSummary {
  address: string;
  totalValueUsd: Decimal;
  chains: {
    chain: Chain;
    nativeBalance: NativeBalance;
    tokenBalances: TokenBalance[];
    nftCount: number;
  }[];
}
