import { useEffect, useState } from 'react';
import type { Game } from '../../../shared/types';
import { getConsoleNameFromId } from '../../../shared/utils/constants';

interface Props {
  game: Game;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InstallModal({ game, onClose, onSuccess }: Props) {
  const [status, setStatus] = useState<'idle' | 'installing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [progressText, setProgressText] = useState('Initializing...');

  useEffect(() => {
    const removeListener = window.electron.on('install-status-update', (msg: string) => {
      setProgressText(msg);
    });
    return () => { if (removeListener) removeListener(); };
  }, []);

  const handleInstall = async () => {
    setStatus('installing');
    setErrorMessage('');

    try {
      const result = await window.electron.invoke('install-engine', game.consoleId);
      
      if (result.success) {
        onSuccess();
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Unknown error occurred');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'IPC failure');
    }
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

        {/* error */}
        {status === 'error' && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-200 text-xs">
            <strong>Installation Failed:</strong> {errorMessage}
          </div>
        )}

        {/* spinner */}
        {status === 'installing' && (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <div className="w-8 h-8 border-4 border-accent-secondary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-accent-secondary font-bold animate-pulse">
              {progressText}
            </p>
          </div>
        )}

        {/* cancel / install */}
        {status !== 'installing' && (
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
        )}
      </div>
    </div>
  );
}