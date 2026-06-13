import type { Game } from '../../../shared/types';
import { getConsoleNameFromId, getEngineIdFromConsoleId, getEmulatorNameFromEngineId } from '../../../shared/constants';
import { engineClient } from '../../clients/engineClient';
import { useNotifications } from '../../hooks/useNotifications';

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
          notify(`${emulatorName} installed successfully`, { type: 'success', duration: durations.short });
          onSuccess();
        } else {
          notify(`Failed to install ${emulatorName}: ${result.error || result.message || 'Unknown error occurred'}`, { type: 'error', duration: durations.long });
        }
      })
      .catch((err) => {
        notify(`Failed to install ${emulatorName}: ${err.message || 'IPC failure'}`, { type: 'error', duration: durations.long });
      });

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.stopPropagation()} 
    >
      <div className="w-full max-w-sm bg-bg-secondary border border-border-muted rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-fg-primary">Emulator Required</h2>
          <p className="text-sm text-fg-muted mt-1">
            To play <strong>{getConsoleNameFromId(game.consoleId)}</strong> games, you need to install the core engine.
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-fg-muted hover:text-fg-primary transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleInstall}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white text-sm font-bold rounded shadow-lg shadow-accent-primary/20 transition-all hover:scale-105 active:scale-95"
          >
            Install Now
          </button>
        </div>
      </div>
    </div>
  );
}