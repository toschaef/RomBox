import { useState } from 'react';
import type { Game } from '../../../shared/types';
import { NOTIFICATION_MESSAGES } from '../../../shared/constants';
import { gameClient } from '../../clients/gameClient';
import { useNotifications } from '../../hooks/useNotifications';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2"
      onClick={(e) => e.stopPropagation()}
      data-testid="locate-game-modal"
    >
      <div className="w-full max-w-md bg-bg-secondary border border-border-muted rounded-xl shadow-2xl p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-fg-primary">Game File Missing</h2>
          <p className="text-sm text-fg-muted mt-1">
            <strong>{game.title}</strong> has been moved or deleted. Locate the ROM's new location to launch it.
          </p>
        </div>

        <span className="block text-[10px] font-bold text-fg-muted uppercase tracking-wider mb-1">
          Previous location
        </span>
        <div className="bg-bg-muted border border-border-subtle rounded p-3 mb-4">
          <span className="block text-xs text-fg-secondary break-all">{game.filePath}</span>
        </div>

        {error && (
          <p className="text-xs text-red-400 mb-4" data-testid="locate-game-error">
            {error}
          </p>
        )}

        <div className="flex justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-fg-muted hover:text-fg-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLocate}
            disabled={isLocating}
            data-testid="locate-game-button"
            className="px-4 py-2 bg-accent-secondary hover:bg-accent-primary/90 text-white text-sm font-bold rounded-sm disabled:opacity-50"
          >
            {isLocating ? 'Locating' : 'Locate ROM'}
          </button>
        </div>
      </div>
    </div>
  );
}
