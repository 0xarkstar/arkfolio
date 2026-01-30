import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Exchanges & Accounts
export const exchanges = sqliteTable('exchanges', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['cex', 'dex', 'perp'] }).notNull(),
  apiKeyRef: text('api_key_ref'), // Reference to safeStorage key
  apiSecretRef: text('api_secret_ref'), // Reference to safeStorage key
  passphraseRef: text('passphrase_ref'), // For exchanges like OKX
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Balances (Spot, Futures, Margin, Earn, Funding)
export const balances = sqliteTable('balances', {
  id: text('id').primaryKey(),
  exchangeId: text('exchange_id').references(() => exchanges.id, { onDelete: 'cascade' }),
  asset: text('asset').notNull(),
  balanceType: text('balance_type', { enum: ['spot', 'futures', 'margin', 'earn', 'funding'] }).notNull(),
  free: real('free').default(0),
  locked: real('locked').default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Futures/Perp Positions
export const positions = sqliteTable('positions', {
  id: text('id').primaryKey(),
  exchangeId: text('exchange_id').references(() => exchanges.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  side: text('side', { enum: ['long', 'short'] }).notNull(),
  size: real('size').default(0),
  entryPrice: real('entry_price'),
  markPrice: real('mark_price'),
  unrealizedPnl: real('unrealized_pnl'),
  leverage: real('leverage').default(1),
  liquidationPrice: real('liquidation_price'),
  marginType: text('margin_type', { enum: ['cross', 'isolated'] }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Transactions (for tax calculation and history)
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  exchangeId: text('exchange_id').references(() => exchanges.id),
  walletAddress: text('wallet_address'),
  txHash: text('tx_hash'),
  type: text('type').notNull(), // buy, sell, transfer_in, transfer_out, swap, stake, unstake, reward, airdrop, etc.
  asset: text('asset').notNull(),
  amount: real('amount').notNull(),
  priceUsd: real('price_usd'),
  priceKrw: real('price_krw'),
  fee: real('fee'),
  feeAsset: text('fee_asset'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  rawData: text('raw_data'), // JSON string for audit trail
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Wallets (On-chain)
export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(),
  address: text('address').notNull(),
  chain: text('chain').notNull(), // ethereum, arbitrum, optimism, base, polygon, bsc, solana
  label: text('label'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// On-chain Assets
export const onchainAssets = sqliteTable('onchain_assets', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').references(() => wallets.id, { onDelete: 'cascade' }),
  contractAddress: text('contract_address'), // null for native tokens
  tokenSymbol: text('token_symbol'),
  tokenName: text('token_name'),
  balance: real('balance').default(0),
  decimals: integer('decimals'),
  isNft: integer('is_nft', { mode: 'boolean' }).default(false),
  tokenId: text('token_id'), // For NFTs
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// DeFi Positions
export const defiPositions = sqliteTable('defi_positions', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').references(() => wallets.id, { onDelete: 'cascade' }),
  protocol: text('protocol').notNull(), // uniswap, aave, morpho, pendle, eigenlayer, etc.
  positionType: text('position_type'), // lp, lending, borrowing, staking, vault, pt, yt
  poolAddress: text('pool_address'),
  assets: text('assets'), // JSON array of asset symbols
  amounts: text('amounts'), // JSON array of amounts
  costBasisUsd: real('cost_basis_usd'),
  currentValueUsd: real('current_value_usd'),
  rewardsEarned: text('rewards_earned'), // JSON object
  apy: real('apy'),
  maturityDate: integer('maturity_date', { mode: 'timestamp' }), // For Pendle PT/YT
  healthFactor: real('health_factor'), // For lending positions
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Points & Airdrops tracking
export const points = sqliteTable('points', {
  id: text('id').primaryKey(),
  protocol: text('protocol').notNull(),
  walletAddress: text('wallet_address'),
  pointsBalance: real('points_balance').default(0),
  estimatedValueUsd: real('estimated_value_usd'),
  lastSync: integer('last_sync', { mode: 'timestamp' }),
});

// Price History (for tax calculation)
export const priceHistory = sqliteTable('price_history', {
  asset: text('asset').notNull(),
  timestamp: integer('timestamp').notNull(),
  priceUsd: real('price_usd'),
  priceKrw: real('price_krw'),
}, (table) => ({
  pk: primaryKey({ columns: [table.asset, table.timestamp] }),
}));

// Tax Reports
export const taxReports = sqliteTable('tax_reports', {
  id: text('id').primaryKey(),
  year: integer('year').notNull(),
  totalGainsKrw: real('total_gains_krw'),
  totalLossesKrw: real('total_losses_krw'),
  netGainsKrw: real('net_gains_krw'),
  taxableGainsKrw: real('taxable_gains_krw'), // After 250만원 or 5000만원 deduction
  estimatedTaxKrw: real('estimated_tax_krw'), // 22% rate
  generatedAt: integer('generated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  reportData: text('report_data'), // JSON with full breakdown
});

// Settings
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Relations
export const exchangesRelations = relations(exchanges, ({ many }) => ({
  balances: many(balances),
  positions: many(positions),
  transactions: many(transactions),
}));

export const balancesRelations = relations(balances, ({ one }) => ({
  exchange: one(exchanges, {
    fields: [balances.exchangeId],
    references: [exchanges.id],
  }),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  exchange: one(exchanges, {
    fields: [positions.exchangeId],
    references: [exchanges.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ many }) => ({
  onchainAssets: many(onchainAssets),
  defiPositions: many(defiPositions),
}));

export const onchainAssetsRelations = relations(onchainAssets, ({ one }) => ({
  wallet: one(wallets, {
    fields: [onchainAssets.walletId],
    references: [wallets.id],
  }),
}));

export const defiPositionsRelations = relations(defiPositions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [defiPositions.walletId],
    references: [wallets.id],
  }),
}));

// Type exports
export type Exchange = typeof exchanges.$inferSelect;
export type NewExchange = typeof exchanges.$inferInsert;
export type Balance = typeof balances.$inferSelect;
export type NewBalance = typeof balances.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
export type OnchainAsset = typeof onchainAssets.$inferSelect;
export type NewOnchainAsset = typeof onchainAssets.$inferInsert;
export type DefiPosition = typeof defiPositions.$inferSelect;
export type NewDefiPosition = typeof defiPositions.$inferInsert;
export type Points = typeof points.$inferSelect;
export type NewPoints = typeof points.$inferInsert;
export type PriceHistoryRecord = typeof priceHistory.$inferSelect;
export type NewPriceHistoryRecord = typeof priceHistory.$inferInsert;
export type TaxReport = typeof taxReports.$inferSelect;
export type NewTaxReport = typeof taxReports.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
