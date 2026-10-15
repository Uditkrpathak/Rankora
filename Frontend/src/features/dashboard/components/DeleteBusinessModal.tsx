import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useDeleteLocationMutation } from '../../../store/api/locationApi';
import { useToast } from '../../../components/ui/Toast';
import { AlertTriangle } from 'lucide-react';

interface DeleteBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  locationId: string;
  businessName: string;
}

export const DeleteBusinessModal: React.FC<DeleteBusinessModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  locationId,
  businessName,
}) => {
  const toast = useToast();
  const [deleteLocation, { isLoading }] = useDeleteLocationMutation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setErrorMsg(null);
      await deleteLocation({ workspaceId, locationId }).unwrap();
      toast.success(`${businessName} was removed from your workspace.`, 'Business deleted');
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: { message?: string } } })?.data?.error?.message ||
        'Failed to delete business location.';
      setErrorMsg(msg);
      toast.error(msg, 'Delete failed');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete business"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-rose-50/70 border border-rose-200/80 rounded-lg text-xs text-rose-900">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Are you sure you want to delete this listing?</p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              This will remove <strong className="font-semibold text-rose-900">{businessName}</strong> and all associated historical scan rankings. This action cannot be undone.
            </p>
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            isLoading={isLoading}
          >
            Delete business
          </Button>
        </div>
      </div>
    </Modal>
  );
};
