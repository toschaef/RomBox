import type { Game } from '../../../shared/types';
import { getConsoleNameFromId } from '../../../shared/utils/constants';

interface Props {
  game: Game;
  onClose: () => void;
}

export default function BiosModal({ game, onClose }: Props) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-bg-secondary border border-border-muted rounded-xl shadow-2xl p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-fg-primary mb-2">BIOS Required</h2>
        <p className="text-fg-muted mb-6">
          To play <strong>{getConsoleNameFromId(game.consoleId)}</strong> games, Mesen requires a BIOS file.
        </p>

        <div className="
          border-2 border-dashed border-border-highlight 
          rounded-xl p-10 bg-bg-muted/50 mb-6 
          pointer-events-none select-none
        ">
          <p className="text-fg-secondary font-semibold">Drag & Drop</p>
          <code className="block mt-2 text-accent-secondary bg-black/30 px-2 py-1 rounded">
             {game.consoleId === 'gba' ? 'gba_bios.bin' : 'BIOS file'}
          </code>
          <p className="text-xs text-fg-muted mt-2">Anywhere on screen</p>
        </div>

        <button 
          onClick={onClose}
          className="text-fg-muted hover:text-fg-primary text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}