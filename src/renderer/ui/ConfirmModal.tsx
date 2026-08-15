import Modal, { ModalTitle, ModalDescription, ModalActions } from './Modal';
import Button from './Button';
import type { ReactNode } from 'react';

export type ConfirmModalProps = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal size="sm" onClose={onClose}>
      <ModalTitle>{title}</ModalTitle>
      <ModalDescription>{description}</ModalDescription>

      <ModalActions>
        <Button intent="ghost" size="md" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          intent={destructive ? 'danger' : 'primary'}
          size="md"
          data-testid="confirm-modal-confirm"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </ModalActions>
    </Modal>
  );
}
