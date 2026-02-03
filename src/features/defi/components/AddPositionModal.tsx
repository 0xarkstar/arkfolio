import { Modal, ModalFooter } from '../../../components/Modal';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Select, Input } from '../../../components/Input';
import { DefiPosition } from '../../../stores/defiStore';
import { PROTOCOLS, POSITION_TYPES, CHAINS } from '../constants';
import type { AddPositionFormData } from '../hooks/useDefiPage';

interface AddPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isAdding: boolean;
  error: string | null;
  form: AddPositionFormData;
  setForm: React.Dispatch<React.SetStateAction<AddPositionFormData>>;
}

export function AddPositionModal({
  isOpen,
  onClose,
  onSubmit,
  isAdding,
  error,
  form,
  setForm,
}: AddPositionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add DeFi Position"
      size="lg"
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Protocol"
            value={form.protocol}
            onChange={(e) => setForm(prev => ({ ...prev, protocol: e.target.value }))}
            options={PROTOCOLS.map(p => ({ value: p, label: p }))}
          />

          <Select
            label="Position Type"
            value={form.type}
            onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value as DefiPosition['positionType'] }))}
            options={POSITION_TYPES.map(t => ({ value: t.value, label: t.label }))}
          />
        </div>

        <Select
          label="Chain"
          value={form.chain}
          onChange={(e) => setForm(prev => ({ ...prev, chain: e.target.value }))}
          options={CHAINS.map(c => ({ value: c, label: c }))}
        />

        <Input
          label="Assets (comma separated)"
          type="text"
          value={form.assets}
          onChange={(e) => setForm(prev => ({ ...prev, assets: e.target.value }))}
          placeholder="ETH, USDC"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount (primary asset)"
            type="number"
            step="any"
            value={form.amount}
            onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="0.00"
          />

          <Input
            label="Current Value (USD)"
            type="number"
            step="any"
            value={form.value}
            onChange={(e) => setForm(prev => ({ ...prev, value: e.target.value }))}
            placeholder="0.00"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Cost Basis (USD)"
            type="number"
            step="any"
            value={form.costBasis}
            onChange={(e) => setForm(prev => ({ ...prev, costBasis: e.target.value }))}
            placeholder="Optional"
          />

          <Input
            label="APY (%)"
            type="number"
            step="any"
            value={form.apy}
            onChange={(e) => setForm(prev => ({ ...prev, apy: e.target.value }))}
            placeholder="Optional"
          />

          <Input
            label="Health Factor"
            type="number"
            step="any"
            value={form.healthFactor}
            onChange={(e) => setForm(prev => ({ ...prev, healthFactor: e.target.value }))}
            placeholder="Optional"
          />
        </div>

        <ModalFooter>
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            disabled={isAdding}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isAdding}
            loading={isAdding}
          >
            Add Position
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
