import Decimal from 'decimal.js';

// Keywords that indicate entry transactions for DeFi positions
export const ENTRY_KEYWORDS = [
  'deposit',
  'supply',
  'stake',
  'staked',
  'mint',
  'minted',
  'add liquidity',
  'added liquidity',
  'provide',
  'provided',
  'lock',
  'locked',
  'enter',
  'entered',
  'bond',
  'bonded',
  'wrap',
  'wrapped',
  'lend',
  'lending',
];

// Keywords for protocols
export const PROTOCOL_KEYWORDS: Record<string, string[]> = {
  aave: ['aave'],
  compound: ['compound', 'comp'],
  uniswap: ['uniswap', 'uni'],
  curve: ['curve', 'crv'],
  convex: ['convex', 'cvx'],
  lido: ['lido', 'steth'],
  yearn: ['yearn', 'yfi', 'yvault'],
  pendle: ['pendle', 'pt-', 'yt-'],
  eigenlayer: ['eigenlayer', 'restake'],
  morpho: ['morpho'],
  makerdao: ['maker', 'dai', 'dsr'],
  gmx: ['gmx'],
  balancer: ['balancer', 'bal'],
  sushiswap: ['sushi'],
  pancakeswap: ['pancake', 'cake'],
  rocketpool: ['rocket pool', 'reth'],
  frax: ['frax'],
};

// Map Zapper network names to our chain names
export const NETWORK_MAP: Record<string, string> = {
  ETHEREUM_MAINNET: 'Ethereum',
  ARBITRUM_MAINNET: 'Arbitrum',
  OPTIMISM_MAINNET: 'Optimism',
  BASE_MAINNET: 'Base',
  POLYGON_MAINNET: 'Polygon',
  BINANCE_SMART_CHAIN_MAINNET: 'BSC',
  AVALANCHE_MAINNET: 'Avalanche',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  polygon: 'Polygon',
  'binance-smart-chain': 'BSC',
  avalanche: 'Avalanche',
};

// Map network names to chain IDs for transactionDetailsV2
export const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ETHEREUM_MAINNET: 1,
  ethereum: 1,
  ARBITRUM_MAINNET: 42161,
  arbitrum: 42161,
  OPTIMISM_MAINNET: 10,
  optimism: 10,
  BASE_MAINNET: 8453,
  base: 8453,
  POLYGON_MAINNET: 137,
  polygon: 137,
  BINANCE_SMART_CHAIN_MAINNET: 56,
  'binance-smart-chain': 56,
  AVALANCHE_MAINNET: 43114,
  avalanche: 43114,
};

export interface CostBasisEntry {
  date: Date;
  tokenSymbol: string;
  amount: Decimal;
  priceAtTime: number;
  totalCostUsd: Decimal;
  txHash: string;
  description: string;
}

export interface PositionCostBasis {
  positionId: string;
  entries: CostBasisEntry[];
  totalCostBasisUsd: Decimal;
  firstEntryDate: Date | null;
}
