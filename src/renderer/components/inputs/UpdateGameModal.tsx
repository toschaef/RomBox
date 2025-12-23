import { useState } from 'react';
import type { Game, LibraryResponse } from '../../../shared/types';

interface Props {
  game: Game;
  onClose: () => void;
  onSave: (updatedGame: Game) => void;
}

export default function UpdateGameModal({ game, onClose, onSave }: Props) {
  const [title, setTitle] = useState(game.title);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updatedGame = { ...game, title };
    
    try {
      const result: LibraryResponse = await window.electron.invoke('update-game', updatedGame);
      if (result.success) {
        onSave(updatedGame);
        onClose();
      }
    } catch (err) {
      console.error("Failed to update", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* modal */}
      <div className="w-full max-w-md bg-bg-secondary border border-border-muted rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-fg-primary mb-6">Edit Game Details</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* onyl title so far */}
          <div>
            <label className="block text-xs font-bold text-fg-muted uppercase tracking-wider mb-2">
              Game Title
            </label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg-muted border border-border-subtle text-fg-primary rounded p-3 focus:outline-none focus:border-accent-secondary focus:ring-1 focus:ring-accent-secondary transition-all"
            />
          </div>

          {/* cancel / submit */}
          <div className="flex justify-end gap-3 mt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-fg-muted hover:text-fg-primary transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="px-6 py-2 bg-accent-secondary hover:bg-accent-primary text-white text-sm font-bold rounded shadow-lg shadow-accent-secondary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}