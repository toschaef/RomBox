import type { Game } from '../../../shared/types';
import GameCard from './GameCard';

interface Props {
  games: Game[];
  lastBiosUpdate: string;
  onRefresh: () => void;
  onUpdate: (game: Game) => void;
  gridSize?: number; // 1=large, 2=medium, 3=default, 4=small
}

const GRID_CLASSES: Record<number, string> = {
  1: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  2: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  3: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  4: 'grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
};

export default function GameGrid({ 
  games, 
  lastBiosUpdate, 
  onRefresh, 
  onUpdate,
  gridSize = 3 
}: Props) {
  if (games.length === 0) {
    return null;
  }

  const gridCols = GRID_CLASSES[gridSize] || GRID_CLASSES[3];

  return (
    <div className={`
      grid 
      ${gridCols}
      gap-6 
      w-full 
      animate-in fade-in
      transition-all duration-300 ease-out
    `}>
      {games.map((game) => (
        <div 
          key={game.id}
          className="transition-all duration-300 ease-out"
        >
          <GameCard
            game={game}
            lastBiosUpdate={lastBiosUpdate}
            onDelete={onRefresh}
            onUpdate={onUpdate}
          />
        </div>
      ))}
    </div>
  );
}