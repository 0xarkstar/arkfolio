import { useState } from 'react';
import { TargetAllocation as TargetAllocationType } from '../../../stores/rebalanceStore';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';

interface TargetAllocationProps {
  allocations: TargetAllocationType[];
  totalPercent: number;
  onUpdateAllocation: (asset: string, percent: number) => void;
  onRemoveAllocation: (id: string) => void;
  onAddAllocation: (asset: string, percent: number) => void;
  isSaving: boolean;
}

export function TargetAllocationEditor({
  allocations,
  totalPercent,
  onUpdateAllocation,
  onRemoveAllocation,
  onAddAllocation,
  isSaving,
}: TargetAllocationProps) {
  const [newAsset, setNewAsset] = useState('');
  const [newPercent, setNewPercent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    if (!newAsset.trim() || !newPercent) return;
    const percent = parseFloat(newPercent);
    if (isNaN(percent) || percent <= 0 || percent > 100) return;

    onAddAllocation(newAsset.trim().toUpperCase(), percent);
    setNewAsset('');
    setNewPercent('');
  };

  const handleEdit = (allocation: TargetAllocationType) => {
    setEditingId(allocation.id);
    setEditValue(allocation.targetPercent.toString());
  };

  const handleSaveEdit = (allocation: TargetAllocationType) => {
    const percent = parseFloat(editValue);
    if (!isNaN(percent) && percent > 0 && percent <= 100) {
      onUpdateAllocation(allocation.asset, percent);
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const isValid = Math.abs(totalPercent - 100) < 0.01;
  const remaining = 100 - totalPercent;

  return (
    <div className="space-y-4">
      {/* Header with total */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-100">Target Allocation</h3>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isValid ? 'text-profit' : 'text-warning'}`}>
            {totalPercent.toFixed(1)}% / 100%
          </span>
          {!isValid && (
            <span className="text-xs text-surface-400">
              ({remaining > 0 ? '+' : ''}{remaining.toFixed(1)}% remaining)
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            totalPercent > 100
              ? 'bg-loss'
              : totalPercent === 100
              ? 'bg-profit'
              : 'bg-primary-500'
          }`}
          style={{ width: `${Math.min(totalPercent, 100)}%` }}
        />
      </div>

      {/* Allocation list */}
      <div className="space-y-2">
        {allocations.map((allocation) => (
          <div
            key={allocation.id}
            className="flex items-center gap-3 p-3 bg-surface-800 rounded-lg"
          >
            <div className="flex-1">
              <span className="font-medium text-surface-100">{allocation.asset}</span>
            </div>

            {editingId === allocation.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-20 px-2 py-1 bg-surface-700 border border-surface-600 rounded text-surface-100 text-right"
                  min="0"
                  max="100"
                  step="0.1"
                  autoFocus
                />
                <span className="text-surface-400">%</span>
                <Button size="xs" variant="primary" onClick={() => handleSaveEdit(allocation)}>
                  Save
                </Button>
                <Button size="xs" variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-24">
                  <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500"
                      style={{ width: `${allocation.targetPercent}%` }}
                    />
                  </div>
                </div>
                <span className="w-16 text-right font-tabular text-surface-100">
                  {allocation.targetPercent.toFixed(1)}%
                </span>
                <Button size="xs" variant="ghost" onClick={() => handleEdit(allocation)}>
                  Edit
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onRemoveAllocation(allocation.id)}
                  className="text-surface-500 hover:text-loss"
                >
                  &times;
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new allocation */}
      <div className="flex items-center gap-3 p-3 bg-surface-800/50 rounded-lg border-2 border-dashed border-surface-700">
        <Input
          type="text"
          value={newAsset}
          onChange={(e) => setNewAsset(e.target.value.toUpperCase())}
          placeholder="Asset (e.g., BTC)"
          className="flex-1"
          size="sm"
        />
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={newPercent}
            onChange={(e) => setNewPercent(e.target.value)}
            placeholder="0"
            className="w-20 text-right"
            size="sm"
            min="0"
            max="100"
            step="0.1"
          />
          <span className="text-surface-400">%</span>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={handleAdd}
          disabled={!newAsset.trim() || !newPercent || isSaving}
        >
          Add
        </Button>
      </div>

      {/* Quick allocation buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-surface-400">Quick add:</span>
        {['BTC', 'ETH', 'SOL', 'USDC', 'USDT'].map((asset) => (
          <button
            key={asset}
            onClick={() => setNewAsset(asset)}
            disabled={allocations.some((a) => a.asset === asset)}
            className="px-2 py-1 text-xs bg-surface-700 hover:bg-surface-600 rounded text-surface-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {asset}
          </button>
        ))}
      </div>
    </div>
  );
}
