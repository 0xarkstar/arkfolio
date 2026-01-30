import { useEffect, useState } from 'react';
import { useNavigationStore } from '../stores/navigationStore';
import { useExchangeStore } from '../stores/exchangeStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useWalletsStore } from '../stores/walletsStore';
import { useDefiStore } from '../stores/defiStore';
import { priceService } from '../services/price';
import Decimal from 'decimal.js';

interface MarketPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

const MARKET_SYMBOLS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'ADA', name: 'Cardano' },
];

export default function Dashboard() {
  const { setView } = useNavigationStore();
  const { accounts, allPositions } = useExchangeStore();
  const { summary, holdings, refreshPortfolio } = usePortfolioStore();
  const { wallets, getTotalValueUsd: getWalletsTotalValue, loadWallets } = useWalletsStore();
  const { positions: defiPositions, getTotalValueUsd: getDefiTotalValue, loadPositions: loadDefiPositions } = useDefiStore();

  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    refreshPortfolio();
    loadWallets();
    loadDefiPositions();
  }, [refreshPortfolio, loadWallets, loadDefiPositions]);

  // Fetch market prices
  useEffect(() => {
    async function fetchPrices() {
      setPricesLoading(true);
      try {
        const symbols = MARKET_SYMBOLS.map(s => s.symbol);
        const prices = await priceService.getPrices(symbols);

        const priceList: MarketPrice[] = MARKET_SYMBOLS.map(({ symbol, name }) => {
          const priceData = prices.get(symbol);
          return {
            symbol,
            name,
            price: priceData?.priceUsd.toNumber() || 0,
            change24h: priceData?.change24h || 0,
          };
        }).filter(p => p.price > 0);

        setMarketPrices(priceList);
      } catch (error) {
        console.error('Failed to fetch market prices:', error);
        // Fallback to cached or default
        setMarketPrices([
          { symbol: 'BTC', name: 'Bitcoin', price: 0, change24h: 0 },
          { symbol: 'ETH', name: 'Ethereum', price: 0, change24h: 0 },
        ]);
      } finally {
        setPricesLoading(false);
      }
    }

    fetchPrices();

    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const connectedExchanges = accounts.filter(a => a.isConnected).length;
  const totalPositions = Array.from(allPositions.values()).reduce(
    (sum, positions) => sum + positions.length,
    0
  );

  // Calculate total portfolio value from all sources
  const cexValue = summary.totalValueUsd;
  const walletsValue = getWalletsTotalValue();
  const defiValue = getDefiTotalValue();
  const totalPortfolioValue = cexValue.plus(walletsValue).plus(defiValue);

  // Calculate risk metrics
  const hasOpenPositions = totalPositions > 0;
  const lowestHealthFactor = defiPositions
    .filter(p => p.healthFactor !== null)
    .reduce((min, p) => Math.min(min, p.healthFactor || Infinity), Infinity);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Portfolio Value"
          value={formatCurrency(totalPortfolioValue.toNumber())}
          subtitle="All assets combined"
          onClick={() => setView('portfolio')}
        />
        <SummaryCard
          title="24h Change"
          value={formatCurrency(summary.change24hUsd.toNumber())}
          subtitle={`${summary.change24hPercent >= 0 ? '+' : ''}${summary.change24hPercent.toFixed(2)}%`}
          trend={summary.change24hPercent >= 0 ? 'profit' : 'loss'}
        />
        <SummaryCard
          title="CEX Assets"
          value={holdings.length > 0 ? formatCurrency(cexValue.toNumber()) : '$0.00'}
          subtitle={`${connectedExchanges} exchange${connectedExchanges !== 1 ? 's' : ''}`}
          onClick={() => setView('exchanges')}
        />
        <SummaryCard
          title="On-chain + DeFi"
          value={formatCurrency(walletsValue.plus(defiValue).toNumber())}
          subtitle={`${wallets.length} wallet${wallets.length !== 1 ? 's' : ''}, ${defiPositions.length} positions`}
          onClick={() => setView('wallets')}
        />
      </div>

      {/* Risk Alert Banner */}
      {(hasOpenPositions || (lowestHealthFactor < 2 && lowestHealthFactor !== Infinity)) && (
        <div className="card p-4 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-4">
            <div className="text-2xl">&#9888;</div>
            <div className="flex-1">
              <p className="font-medium text-surface-100">Risk Alert</p>
              <p className="text-sm text-surface-400">
                {totalPositions > 0 && `${totalPositions} open futures position${totalPositions !== 1 ? 's' : ''}. `}
                {lowestHealthFactor < 2 && lowestHealthFactor !== Infinity &&
                  `Lowest health factor: ${lowestHealthFactor.toFixed(2)}`}
              </p>
            </div>
            <button onClick={() => setView('defi')} className="btn-secondary text-sm">
              View Risk
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard
            title="Connect Exchange"
            description="Add your CEX accounts to track balances and trades"
            action="Add Exchange"
            onClick={() => setView('exchanges')}
          />
          <ActionCard
            title="Add Wallet"
            description="Track your on-chain assets across multiple networks"
            action="Add Wallet"
            onClick={() => setView('wallets')}
          />
          <ActionCard
            title="View Tax Report"
            description="Check your tax obligations and export reports"
            action="View Report"
            onClick={() => setView('tax')}
          />
        </div>
      </div>

      {/* Portfolio Breakdown & Market Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Breakdown */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Portfolio Breakdown</h2>
          {totalPortfolioValue.greaterThan(0) ? (
            <div className="space-y-4">
              <BreakdownItem
                label="CEX Holdings"
                value={cexValue}
                total={totalPortfolioValue}
                color="bg-primary-500"
                onClick={() => setView('exchanges')}
              />
              <BreakdownItem
                label="On-chain Wallets"
                value={walletsValue}
                total={totalPortfolioValue}
                color="bg-profit"
                onClick={() => setView('wallets')}
              />
              <BreakdownItem
                label="DeFi Positions"
                value={defiValue}
                total={totalPortfolioValue}
                color="bg-blue-500"
                onClick={() => setView('defi')}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-surface-500">
              <p>No assets tracked yet</p>
              <p className="text-sm mt-1">Connect an exchange or add a wallet</p>
            </div>
          )}
        </div>

        {/* Market Overview */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Market Overview</h2>
          {pricesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-700 rounded-full" />
                    <div>
                      <div className="h-4 w-12 bg-surface-700 rounded" />
                      <div className="h-3 w-16 bg-surface-800 rounded mt-1" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 w-20 bg-surface-700 rounded" />
                    <div className="h-3 w-10 bg-surface-800 rounded mt-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {marketPrices.map((coin) => (
                <div
                  key={coin.symbol}
                  className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-700 rounded-full flex items-center justify-center text-xs font-medium text-primary-400">
                      {coin.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-surface-100">{coin.symbol}</p>
                      <p className="text-xs text-surface-400">{coin.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-surface-100 font-tabular">
                      ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs font-tabular ${coin.change24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Holdings */}
      {holdings.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-100">Top Holdings</h2>
            <button
              onClick={() => setView('portfolio')}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {holdings.slice(0, 6).map((holding) => (
              <div
                key={holding.symbol}
                className="bg-surface-800 rounded-lg p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center text-sm font-medium text-primary-400">
                  {holding.symbol.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-100 truncate">{holding.symbol}</p>
                  <p className="text-xs text-surface-400 font-tabular">
                    {formatAmount(holding.totalAmount.toNumber())}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-surface-100 font-tabular">
                    {formatCurrency(holding.valueUsd.toNumber())}
                  </p>
                  <p className={`text-xs font-tabular ${holding.change24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {holding.change24h >= 0 ? '+' : ''}{holding.change24h.toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      {accounts.length === 0 && wallets.length === 0 && (
        <div className="card p-4 border-primary-600/30 bg-primary-600/5">
          <div className="flex items-center gap-4">
            <div className="text-2xl">&#128075;</div>
            <div className="flex-1">
              <p className="font-medium text-surface-100">Welcome to ArkFolio!</p>
              <p className="text-sm text-surface-400">
                Get started by connecting your first exchange or adding a wallet to track.
              </p>
            </div>
            <button onClick={() => setView('exchanges')} className="btn-primary">
              Get Started
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend?: 'profit' | 'loss';
  onClick?: () => void;
}

function SummaryCard({ title, value, subtitle, trend, onClick }: SummaryCardProps) {
  return (
    <div
      className={`card p-4 ${onClick ? 'cursor-pointer hover:bg-surface-800/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <p className="text-sm text-surface-400 mb-1">{title}</p>
      <p className="text-2xl font-semibold font-tabular text-surface-100">{value}</p>
      <p className={`text-sm mt-1 ${
        trend === 'profit' ? 'text-profit' :
        trend === 'loss' ? 'text-loss' :
        'text-surface-400'
      }`}>
        {subtitle}
      </p>
    </div>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}

function ActionCard({ title, description, action, onClick }: ActionCardProps) {
  return (
    <div className="bg-surface-800 rounded-lg p-4 flex flex-col">
      <h3 className="font-medium text-surface-100 mb-2">{title}</h3>
      <p className="text-sm text-surface-400 mb-4 flex-1">{description}</p>
      <button onClick={onClick} className="btn-primary text-sm">
        {action}
      </button>
    </div>
  );
}

interface BreakdownItemProps {
  label: string;
  value: Decimal;
  total: Decimal;
  color: string;
  onClick?: () => void;
}

function BreakdownItem({ label, value, total, color, onClick }: BreakdownItemProps) {
  const percent = total.greaterThan(0) ? value.div(total).times(100).toNumber() : 0;

  return (
    <div
      className={`${onClick ? 'cursor-pointer hover:bg-surface-800/30 rounded-lg p-2 -m-2 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <span className="text-surface-300">{label}</span>
        </div>
        <div className="text-right">
          <span className="font-medium text-surface-100 font-tabular">
            {formatCurrency(value.toNumber())}
          </span>
          <span className="text-surface-500 text-sm ml-2">
            ({percent.toFixed(1)}%)
          </span>
        </div>
      </div>
      <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAmount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  if (value >= 1) {
    return value.toFixed(4);
  }
  return value.toFixed(6);
}
