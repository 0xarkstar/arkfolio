import { Modal, ModalFooter } from '../../../components/Modal';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import type { AddPointsFormData } from '../hooks/useDefiPage';

interface AddPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isAdding: boolean;
  error: string | null;
  form: AddPointsFormData;
  setForm: React.Dispatch<React.SetStateAction<AddPointsFormData>>;
}

export function AddPointsModal({
  isOpen,
  onClose,
  onSubmit,
  isAdding,
  error,
  form,
  setForm,
}: AddPointsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Points"
      size="md"
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Protocol Name"
          type="text"
          value={form.protocol}
          onChange={(e) => setForm(prev => ({ ...prev, protocol: e.target.value }))}
          placeholder="e.g., EigenLayer, Renzo, Ethena"
          required
        />

        <Input
          label="Points Balance"
          type="number"
          step="any"
          value={form.balance}
          onChange={(e) => setForm(prev => ({ ...prev, balance: e.target.value }))}
          placeholder="0"
          required
        />

        <Input
          label="Estimated Value (USD) - Optional"
          hint="Your estimate of the potential airdrop value"
          type="number"
          step="any"
          value={form.estValue}
          onChange={(e) => setForm(prev => ({ ...prev, estValue: e.target.value }))}
          placeholder="0.00"
        />

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
            Add Points
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
