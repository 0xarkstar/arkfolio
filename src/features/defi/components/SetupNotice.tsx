import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';

interface SetupNoticeProps {
  isZapperConfigured: boolean;
  isSyncing: boolean;
  onSyncFromZapper: () => void;
  onAddPosition: () => void;
}

export function SetupNotice({
  isZapperConfigured,
  isSyncing,
  onSyncFromZapper,
  onAddPosition,
}: SetupNoticeProps) {
  return (
    <Card className="p-6 border-primary-600/30 bg-primary-600/5">
      <h3 className="text-lg font-semibold text-surface-100 mb-2">
        DeFi Position Tracking
      </h3>
      {!isZapperConfigured ? (
        <>
          <p className="text-surface-400 text-sm mb-4">
            To automatically detect your DeFi positions, set up your Zapper API key in Settings.
            <br />
            Supported protocols: Uniswap, Aave, Morpho, Pendle, EigenLayer, and more.
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => window.location.hash = '#/settings'}
            >
              Go to Settings
            </Button>
            <Button variant="secondary" onClick={onAddPosition}>
              Add Position Manually
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-surface-400 text-sm mb-4">
            Click "Sync from Zapper" to detect your DeFi positions automatically.
            <br />
            Make sure you have wallets connected in the Wallets page.
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={onSyncFromZapper}
              loading={isSyncing}
              disabled={isSyncing}
            >
              Sync from Zapper
            </Button>
            <Button variant="secondary" onClick={onAddPosition}>
              Add Position Manually
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
