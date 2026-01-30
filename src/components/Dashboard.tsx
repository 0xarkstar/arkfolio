import { useNavigationStore } from '../stores/navigationStore';
import { useExchangeStore } from '../stores/exchangeStore';

export default function Dashboard() {
  const { setView } = useNavigationStore();
  const { accounts, getAggregatedBalances, allPositions } = useExchangeStore();

  const balances = getAggregatedBalances();
  const connectedExchanges = accounts.filter(a => a.isConnected).length;
  const totalPositions = Array.from(allPositions.values()).reduce(
    (sum, positions) => sum + positions.length,
    0
  );

  // Mock data for now
  const portfolioSummary = {
    totalValue: 125432.56,
    change24h: 2341.23,
    changePercent: 1.9,
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Portfolio Value"
          value={formatCurrency(portfolioSummary.totalValue)}
          subtitle="USD"
        />
        <SummaryCard
          title="24h Change"
          value={formatCurrency(portfolioSummary.change24h)}
          subtitle={`${portfolioSummary.changePercent >= 0 ? '+' : ''}${portfolioSummary.changePercent.toFixed(2)}%`}
          trend={portfolioSummary.change24h >= 0 ? 'profit' : 'loss'}
        />
        <SummaryCard
          title="CEX Assets"
          value={balances.length > 0 ? `${balances.length} assets` : '$0.00'}
          subtitle={`${connectedExchanges} exchange${connectedExchanges !== 1 ? 's' : ''}`}
        />
        <SummaryCard
          title="Open Positions"
          value={totalPositions.toString()}
          subtitle="Futures/Perp"
        />
      </div>

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

      {/* Market Overview (Mock) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Market Overview</h2>
          <div className="space-y-3">
            {[
              { symbol: 'BTC', name: 'Bitcoin', price: 67234.56, change: 2.34 },
              { symbol: 'ETH', name: 'Ethereum', price: 3456.78, change: -1.23 },
              { symbol: 'SOL', name: 'Solana', price: 123.45, change: 5.67 },
              { symbol: 'BNB', name: 'BNB', price: 567.89, change: 0.45 },
            ].map((coin) => (
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
                    ${coin.price.toLocaleString()}
                  </p>
                  <p className={`text-xs font-tabular ${coin.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {coin.change >= 0 ? '+' : ''}{coin.change}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Recent Activity</h2>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-surface-500">
              <p>No activity yet</p>
              <p className="text-sm mt-1">Connect an exchange or wallet to see your transactions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { type: 'Trade', asset: 'BTC', action: 'Buy', amount: '0.05', time: '2 hours ago' },
                { type: 'Deposit', asset: 'USDT', action: 'Received', amount: '1,000', time: '5 hours ago' },
                { type: 'Trade', asset: 'ETH', action: 'Sell', amount: '2.5', time: '1 day ago' },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                      activity.action === 'Buy' || activity.action === 'Received'
                        ? 'bg-profit/20 text-profit'
                        : 'bg-loss/20 text-loss'
                    }`}>
                      {activity.action === 'Buy' || activity.action === 'Received' ? '↓' : '↑'}
                    </div>
                    <div>
                      <p className="font-medium text-surface-100">{activity.action} {activity.asset}</p>
                      <p className="text-xs text-surface-400">{activity.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-surface-100 font-tabular">
                      {activity.amount} {activity.asset}
                    </p>
                    <p className="text-xs text-surface-400">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alert Banner */}
      {accounts.length === 0 && (
        <div className="card p-4 border-primary-600/30 bg-primary-600/5">
          <div className="flex items-center gap-4">
            <div className="text-2xl">👋</div>
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
}

function SummaryCard({ title, value, subtitle, trend }: SummaryCardProps) {
  return (
    <div className="card p-4">
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
