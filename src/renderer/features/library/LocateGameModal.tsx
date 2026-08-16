import { useState } from 'react';
import type { Game } from '../../../shared/types';
import { NOTIFICATION_MESSAGES } from '../../../shared/constants';
import { gameClient } from '../../clients/gameClient';
import { useNotifications } from '../../app/notifications/NotificationProvider';
import { Button, Modal, ModalActions, ModalDescription, ModalTitle } from '../../ui';

interface Props {
  game: Game;
  onClose: () => void;
  onSuccess: (game: Game) => void;
}

export default function LocateGameModal({ game, onClose, onSuccess }: Props) {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify, durations } = useNotifications();

  const handleLocate = async () => {
    setIsLocating(true);
    setError(null);

    try {
      const result = await gameClient.relocate(game.id);

      if (result.success && result.game) {
        notify(NOTIFICATION_MESSAGES.GAME_RELOCATED(game.title), { type: 'success', duration: durations.short });
        onSuccess(result.game);
        return;
      }

      if (result.code === 'CANCELLED') return;

      setError(result.message ?? 'Could not update the location of this game');
    } catch (err) {
      console.error('Failed to relocate game', err);
      setError(NOTIFICATION_MESSAGES.RELOCATE_FAILED(game.title));
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <Modal onClose={onClose} closeOnBackdrop={false} data-testid="locate-game-modal">
      <div className="mb-4">
        <ModalTitle>Game File Missing</ModalTitle>
        <ModalDescription>
          <strong>{game.title}</strong> has been moved or deleted. Locate the ROM&apos;s new location to launch it.
        </ModalDescription>
      </div>

      <span className="block text-[10px] font-bold text-fg-muted uppercase tracking-wider mb-1">
        Previous location
      </span>
      <div className="bg-bg-muted border border-border-subtle rounded-sm p-3 mb-4">
        <span className="block text-xs text-fg-secondary break-all">{game.filePath}</span>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-4" data-testid="locate-game-error">
          {error}
        </p>
      )}

      <ModalActions>
        <Button intent="ghost" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button
          intent="primary"
          size="md"
          onClick={handleLocate}
          disabled={isLocating}
          data-testid="locate-game-button"
        >
          {isLocating ? 'Locating' : 'Locate ROM'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
