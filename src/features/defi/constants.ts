import Decimal from 'decimal.js';
import type { DefiPosition } from '../../stores/defiStore';

export const POSITION_TYPES = [
  { value: 'lending', label: 'Lending' },
  { value: 'borrowing', label: 'Borrowing' },
  { value: 'lp', label: 'Liquidity Pool' },
  { value: 'staking', label: 'Staking' },
  { value: 'vault', label: 'Vault' },
  { value: 'pt', label: 'Principal Token (PT)' },
  { value: 'yt', label: 'Yield Token (YT)' },
  { value: 'restaking', label: 'Restaking' },
];

export const CHAINS = ['Ethereum', 'Arbitrum', 'Optimism', 'Base', 'Polygon', 'BSC', 'Avalanche', 'Solana'];

export const PROTOCOLS = [
  'Aave V3', 'Compound', 'Morpho', 'Spark', // Lending
  'Uniswap V3', 'Uniswap V2', 'SushiSwap', 'Curve', 'Balancer', // DEX
  'Pendle', 'Convex', 'Yearn', // Yield
  'EigenLayer', 'Lido', 'Rocket Pool', // Staking
  'Other',
];

// Mock data for demonstration when no real data exists
export const MOCK_POSITIONS: DefiPosition[] = [
  {
    id: '1',
    walletId: 'demo',
    protocol: 'Uniswap V3',
    positionType: 'lp',
    poolAddress: null,
    assets: ['ETH', 'USDC'],
    amounts: [new Decimal(2.5), new Decimal(5000)],
    costBasisUsd: new Decimal(14000),
    currentValueUsd: new Decimal(15000),
    rewardsEarned: {},
    apy: 12.5,
    maturityDate: null,
    healthFactor: null,
    chain: 'Ethereum',
    entryDate: new Date('2024-01-15'),
    updatedAt: new Date(),
  },
  {
    id: '2',
    walletId: 'demo',
    protocol: 'Aave V3',
    positionType: 'lending',
    poolAddress: null,
    assets: ['USDC'],
    amounts: [new Decimal(25000)],
    costBasisUsd: new Decimal(25000),
    currentValueUsd: new Decimal(25000),
    rewardsEarned: {},
    apy: 4.2,
    maturityDate: null,
    healthFactor: 2.8,
    chain: 'Arbitrum',
    entryDate: new Date('2024-02-20'),
    updatedAt: new Date(),
  },
  {
    id: '3',
    walletId: 'demo',
    protocol: 'Pendle',
    positionType: 'pt',
    poolAddress: null,
    assets: ['stETH'],
    amounts: [new Decimal(5)],
    costBasisUsd: new Decimal(9500),
    currentValueUsd: new Decimal(10000),
    rewardsEarned: {},
    apy: 8.5,
    maturityDate: new Date('2024-12-26'),
    healthFactor: null,
    chain: 'Ethereum',
    entryDate: new Date('2024-03-10'),
    updatedAt: new Date(),
  },
  {
    id: '4',
    walletId: 'demo',
    protocol: 'EigenLayer',
    positionType: 'restaking',
    poolAddress: null,
    assets: ['stETH'],
    amounts: [new Decimal(15)],
    costBasisUsd: new Decimal(28000),
    currentValueUsd: new Decimal(30000),
    rewardsEarned: {},
    apy: 0,
    maturityDate: null,
    healthFactor: null,
    chain: 'Ethereum',
    entryDate: new Date('2024-04-01'),
    updatedAt: new Date(),
  },
  {
    id: '5',
    walletId: 'demo',
    protocol: 'Morpho',
    positionType: 'vault',
    poolAddress: null,
    assets: ['USDC'],
    amounts: [new Decimal(8000)],
    costBasisUsd: new Decimal(8000),
    currentValueUsd: new Decimal(8000),
    rewardsEarned: { MORPHO: new Decimal(45) },
    apy: 6.8,
    maturityDate: null,
    healthFactor: null,
    chain: 'Base',
    entryDate: new Date('2024-05-15'),
    updatedAt: new Date(),
  },
];

export const MOCK_POINTS = [
  { id: '1', protocol: 'EigenLayer', walletAddress: '', pointsBalance: new Decimal(12500), estimatedValueUsd: null, lastSync: null },
  { id: '2', protocol: 'Renzo', walletAddress: '', pointsBalance: new Decimal(8200), estimatedValueUsd: new Decimal(450), lastSync: null },
  { id: '3', protocol: 'Ethena', walletAddress: '', pointsBalance: new Decimal(5600), estimatedValueUsd: new Decimal(280), lastSync: null },
  { id: '4', protocol: 'Blast', walletAddress: '', pointsBalance: new Decimal(15000), estimatedValueUsd: null, lastSync: null },
];
