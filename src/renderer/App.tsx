import { useEffect, useState } from 'react';
import FileInput from './components/inputs/FileInput';
import { ACCEPTED_EXTENSIONS } from '../shared/utils';
import type { Game } from '../shared/types';

export default function App() {
  const [games, setGames] = useState<Game[]>([]);

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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = window.electron.getPathForFile(file);

      const filePayload = {
        name: file.name,
        path: filePath 
      };

      try {
        console.log(`Sending ${file.name} to backend...`);
        const result = await window.electron.invoke('create-game', filePayload);

        if (result.success) {
          console.log("Game created successfully:", result.game);
        } else {
          console.error("Failed to add game:", result.message);
        }
      } catch (e) {
        console.error("IPC Error:", e);
      }
    }

    fetchGames();
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl mb-8 font-bold">My Library</h1>
      
      {/* file input */}
      <div className="mb-10">
        <FileInput 
          onChange={handleFileUpload} 
          accept={ACCEPTED_EXTENSIONS}
        />
      </div>

      {/* games grid */}
      <div className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {games.map((game) => (
          <div 
            key={game.id} 
            className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition duration-200 cursor-pointer shadow-lg"
          >
            <div className="h-32 bg-gray-900 rounded mb-3 flex items-center justify-center text-gray-500 font-mono text-sm border border-gray-700">
              {game.consoleId.toUpperCase()}
            </div>
            
            <h3 className="font-bold text-sm truncate" title={game.title}>
              {game.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1 capitalize">
              {game.consoleId}
            </p>
          </div>
        ))}
      </div>

      {games.length === 0 && (
        <div className="mt-10 text-gray-500 text-sm">
          Drag and drop NES ROMs to get started
        </div>
      )}
    </div>
  );
}