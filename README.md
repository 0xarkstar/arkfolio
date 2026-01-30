# ArkFolio

> Hybrid Crypto Asset Aggregator - Desktop application for unified portfolio management across CEX, DEX, and on-chain assets

[한국어](./docs/README.ko.md)

## Overview

ArkFolio is a privacy-first desktop application that aggregates all your cryptocurrency holdings in one place. Unlike cloud-based portfolio trackers, ArkFolio stores all data locally using encrypted storage, giving you complete control over your financial data.

## Features

### Implemented
- **CEX Integration** - Connect Binance, Upbit, and OKX accounts via API
  - Spot balance tracking
  - Futures/perpetual position monitoring
  - Transaction history sync
  - Real-time WebSocket updates (ready)
- **On-chain Wallet Tracking** - Multi-chain support (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche, Solana)
- **DeFi Position Management** - Manual entry for LP, lending, staking, and vault positions
- **Price Feed** - Real-time prices via CoinGecko API
- **Watchlist** - Track favorite assets with live price updates
- **Risk Dashboard** - Portfolio risk scoring, leverage monitoring, health factor tracking
- **Global Search** - Quick navigation and asset lookup (Cmd/Ctrl+K)
- **Auto-sync** - Configurable automatic data refresh
- **Secure Storage** - OS-level encryption for API keys via Electron safeStorage
- **Local Database** - SQLite WASM with OPFS for persistent, browser-sandboxed storage
- **Modern UI** - Dark theme dashboard with responsive layout

### In Progress
- **Korean Tax Compliance** - Moving average cost basis calculation (UI ready)
- **DeFi Protocol Integration** - Automatic position detection from protocols

### Planned
- **DEX Integration** - Hyperliquid, dYdX perpetual position tracking
- **HomeTax Export** - Korean tax report generation
- **Google Drive Backup** - Encrypted cloud backup option

## Screenshots

*Coming soon*

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Electron + Vite + React 18 |
| Language | TypeScript |
| Database | SQLite WASM (sql.js) + OPFS |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS |
| State | Zustand |
| Charts | Lightweight Charts (TradingView) |
| Exchange APIs | CCXT + Custom adapters |

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Development Setup

```bash
# Clone the repository
git clone https://github.com/0xarkstar/arkfolio.git
cd arkfolio

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
# Build the application
npm run build

# The built application will be in the dist/ directory
```

## Project Structure

```
arkfolio/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # IPC bridge
│   └── services/
│       └── safeStorage.ts   # API key encryption
├── src/
│   ├── components/          # Shared UI components
│   │   └── layout/          # Layout components
│   ├── features/
│   │   ├── cex/             # CEX integration
│   │   ├── dex/             # DEX integration (planned)
│   │   ├── onchain/         # Wallet tracking (planned)
│   │   ├── defi/            # DeFi analytics (planned)
│   │   ├── tax/             # Tax reporting (planned)
│   │   └── settings/        # App settings
│   ├── database/
│   │   ├── schema.ts        # Drizzle schema (11 tables)
│   │   └── init.ts          # SQLite WASM initialization
│   ├── services/
│   │   └── exchanges/       # Exchange API adapters
│   └── stores/              # Zustand state management
└── public/
    └── sql-wasm.wasm        # SQLite WASM binary
```

## Development Status

| Feature | Status | Progress |
|---------|--------|----------|
| Project Setup (Electron + Vite + React) | Done | 100% |
| SQLite WASM + OPFS Storage | Done | 100% |
| Database Schema (Drizzle ORM) | Done | 100% |
| Electron safeStorage | Done | 100% |
| CEX Adapters (Binance, Upbit, OKX) | Done | 100% |
| UI Layout & Navigation | Done | 100% |
| Price Feed (CoinGecko) | Done | 100% |
| Transaction Sync | Done | 100% |
| Watchlist | Done | 100% |
| Global Search | Done | 100% |
| Auto-sync | Done | 100% |
| Risk Dashboard | Done | 100% |
| Portfolio Page | Done | 90% |
| Settings Page | Done | 80% |
| Wallets Page | In Progress | 60% |
| DeFi Page | In Progress | 50% |
| Tax Page | In Progress | 30% |
| DEX Integration | Not Started | 0% |
| Google Drive Backup | Not Started | 0% |

## Roadmap

### Phase 1: Foundation (Complete)
- [x] Electron + Vite + React setup
- [x] SQLite WASM with OPFS
- [x] Drizzle ORM schema
- [x] CEX adapters (Binance, Upbit, OKX)
- [x] Basic UI layout

### Phase 2: CEX & Portfolio (Complete)
- [x] Trade history import
- [x] Portfolio aggregation logic
- [x] Price feed integration (CoinGecko)
- [x] Watchlist with live prices
- [x] Global search
- [x] Auto-sync functionality
- [ ] Real-time balance sync via WebSocket

### Phase 3: On-chain & Wallets (Current)
- [x] EVM wallet tracking (basic)
- [x] Solana wallet tracking (basic)
- [x] Multi-chain balance display
- [ ] Automatic token detection
- [ ] NFT tracking

### Phase 4: DeFi & Analytics (In Progress)
- [x] Manual LP position entry
- [x] Manual lending position entry
- [x] Points/airdrop tracking (manual)
- [ ] Automatic protocol integration
- [ ] Pendle PT/YT support

### Phase 5: Risk Management (Complete)
- [x] Net equity calculation
- [x] Risk score computation
- [x] Health factor monitoring
- [x] Concentration analysis
- [ ] Liquidation alerts

### Phase 6: Tax & Compliance (Planned)
- [ ] Korean tax calculation engine
- [ ] Transaction categorization
- [ ] HomeTax export format
- [ ] Audit trail support

### Phase 7: Backup & Sync (Planned)
- [ ] Google Drive backup
- [ ] Encrypted export/import
- [ ] Multi-device sync

## Database Schema

ArkFolio uses 11 tables to track your crypto portfolio:

- `exchanges` - Connected exchange accounts
- `balances` - Asset balances (spot, futures, margin, earn)
- `positions` - Futures/perpetual positions
- `transactions` - Trade and transfer history
- `wallets` - On-chain wallet addresses
- `onchain_assets` - Token balances per wallet
- `defi_positions` - DeFi protocol positions
- `points` - Protocol points and airdrops
- `price_history` - Historical price data
- `tax_reports` - Generated tax reports
- `settings` - Application settings

## Security

- **No cloud storage** - All data stored locally on your device
- **API key encryption** - Uses OS-level encryption (Keychain on macOS, Credential Manager on Windows)
- **Read-only API keys** - Only requires read permissions for exchange APIs
- **No tracking** - Zero telemetry or analytics

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [CCXT](https://github.com/ccxt/ccxt) - CryptoCurrency eXchange Trading Library
- [sql.js](https://github.com/sql-js/sql.js) - SQLite compiled to WebAssembly
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Lightweight Charts](https://github.com/nicholasdavies/lightweight-charts) - TradingView charting library

---

Built with care by [ArkStar](https://github.com/0xarkstar)
