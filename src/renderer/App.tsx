import { useEffect, useState } from 'react';
import type { Game } from '../shared/types';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import GameGrid from './components/GameGrid';
import UpdateGameModal from './components/inputs/UpdateGameModal';

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  const fetchGames = async () => {
    try {
      const result = await window.electron.invoke('get-games');
      if (result.success) {
        setGames(result.games);
      }
    } catch (e) {
      console.error("Failed to fetch library:", e);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const onFilesDropped = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = window.electron.getPathForFile(file);
      
      try {
        await window.electron.invoke('create-game', { name: file.name, path: filePath });
      } catch (err) {
        console.error("IPC Error:", err);
      }
    }
    fetchGames();
  };

  const { isDragging, dragProps } = useDragAndDrop(onFilesDropped);

  return (
    <div 
      {...dragProps} 
      className={`
        flex flex-col items-center min-h-screen p-8 transition-colors duration-200
        bg-bg-primary text-fg-primary
        ${isDragging ? 'bg-bg-muted border-4 border-border-highlight border-dashed' : ''}
      `}
    >
      <h1 className="text-3xl mb-8 font-bold text-fg-primary">My Library</h1>

      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none z-50">
          <h2 className="text-4xl font-bold text-fg-muted animate-pulse">Drop File to Add Game</h2>
        </div>
      )}

      <GameGrid
        games={games}
        onRefresh={fetchGames}
        onUpdate={(game: Game) => setEditingGame(game)}
      />

      {/* update modal */}
      {editingGame && (
        <UpdateGameModal
          game={editingGame}
          onClose={() => setEditingGame(null)}
          onSave={() => {
            fetchGames();
            setEditingGame(null);
          }}
        />
      )}
    </div>
  );
}