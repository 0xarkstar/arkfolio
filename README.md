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
  - Real-time WebSocket updates (ready)
- **Secure Storage** - OS-level encryption for API keys via Electron safeStorage
- **Local Database** - SQLite WASM with OPFS for persistent, browser-sandboxed storage
- **Modern UI** - Dark theme dashboard with responsive layout

### Planned
- **DEX Integration** - Hyperliquid, dYdX perpetual position tracking
- **On-chain Tracking** - Multi-chain wallet monitoring (EVM + Solana)
- **DeFi Analytics** - LP positions, lending protocols, yield farming
- **Korean Tax Compliance** - Moving average cost basis, HomeTax-compatible reports
- **Risk Management** - Portfolio health monitoring, liquidation alerts
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
| Portfolio Page | In Progress | 30% |
| Settings Page | In Progress | 50% |
| Wallets Page | Mockup | 5% |
| DeFi Page | Mockup | 5% |
| Tax Page | Mockup | 5% |
| DEX Integration | Not Started | 0% |
| On-chain Indexing | Not Started | 0% |
| Price Oracle | Not Started | 0% |

## Roadmap

### Phase 1: Foundation (Current)
- [x] Electron + Vite + React setup
- [x] SQLite WASM with OPFS
- [x] Drizzle ORM schema
- [x] CEX adapters (Binance, Upbit, OKX)
- [x] Basic UI layout

### Phase 2: CEX Completion
- [ ] Real-time balance sync via WebSocket
- [ ] Trade history import
- [ ] Portfolio aggregation logic
- [ ] Price feed integration

### Phase 3: DEX & On-chain
- [ ] Hyperliquid integration
- [ ] dYdX v4 integration
- [ ] EVM wallet tracking
- [ ] Solana wallet tracking

### Phase 4: DeFi & Analytics
- [ ] LP position tracking
- [ ] Lending protocol integration
- [ ] Pendle PT/YT support
- [ ] Points/airdrop tracking

### Phase 5: Tax & Compliance
- [ ] Korean tax calculation engine
- [ ] Transaction categorization
- [ ] HomeTax export format
- [ ] Audit trail support

### Phase 6: Risk & Backup
- [ ] Net equity calculation
- [ ] Liquidation alerts
- [ ] Google Drive backup
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
