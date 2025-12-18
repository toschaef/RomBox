import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Game } from '../../shared/types';
import GameGrid from '../components/GameGrid';
import UpdateGameModal from '../components/inputs/UpdateGameModal';
import type { LayoutContextType } from '../components/layout';

export default function Library() {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  const { lastBiosUpdate, refreshLibraryTrigger } = useOutletContext<LayoutContextType>();

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

  // listen for refresh
  useEffect(() => {
    if (refreshLibraryTrigger > 0) {
      fetchGames();
    }
  }, [refreshLibraryTrigger]);

  return (
    <div 
      className="
        flex flex-col items-center min-h-screen p-8 transition-colors duration-200
        bg-bg-primary text-fg-primary
      "
    >
      <h1 className="text-3xl mb-8 font-bold text-fg-secondary">Games</h1>

      <GameGrid
        games={games}
        onRefresh={fetchGames}
        onUpdate={(game: Game) => setEditingGame(game)}
        lastBiosUpdate={lastBiosUpdate}
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