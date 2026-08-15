import type { Game } from '../../../shared/types';
import { NOTIFICATION_MESSAGES } from '../../../shared/constants';
import { getConsoleNameFromId, getEngineIdFromConsoleId, getEmulatorNameFromEngineId } from '../../../shared/emulators/derived';
import { engineClient } from '../../clients/engineClient';
import { useNotifications } from '../../app/notifications/NotificationProvider';
import { Button, Modal, ModalActions, ModalDescription, ModalTitle } from '../../ui';

interface Props {
  game: Game;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InstallModal({ game, onClose, onSuccess }: Props) {
  const engineId = getEngineIdFromConsoleId(game.consoleId);
  const { notify, durations } = useNotifications();

  const handleInstall = () => {
    const emulatorName = getEmulatorNameFromEngineId(engineId);

    engineClient.installEngine(engineId)
      .then((result) => {
        if (result.success) {
          notify(NOTIFICATION_MESSAGES.INSTALL_SUCCESS(emulatorName), { type: 'success', duration: durations.short });
          onSuccess();
        } else {
          notify(NOTIFICATION_MESSAGES.INSTALL_FAILED(emulatorName, result.error || result.message || 'Unknown error occurred'), { type: 'error', duration: durations.long });
        }
      })
      .catch((err) => {
        notify(NOTIFICATION_MESSAGES.INSTALL_FAILED(emulatorName, err.message || 'IPC failure'), { type: 'error', duration: durations.long });
      });

    onClose();
  };

  return (
    <Modal size="sm" onClose={onClose} closeOnBackdrop={false}>
      <div className="mb-4">
        <ModalTitle>Emulator Required</ModalTitle>
        <ModalDescription>
          To play <strong>{getConsoleNameFromId(game.consoleId)}</strong> games, you need to install the core engine.
        </ModalDescription>
      </div>

      <ModalActions>
        <Button intent="ghost" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button intent="primary" size="md" onClick={handleInstall}>
          Install Now
        </Button>
      </ModalActions>
    </Modal>
  );
}
