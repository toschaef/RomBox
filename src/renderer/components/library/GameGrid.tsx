import type { Game } from '../../../shared/types';
import GameCard from './GameCard';

interface Props {
  games: Game[];
  lastBiosUpdate: string;
  onRefresh: () => void;
  onUpdate: (game: Game) => void;
  gridSize?: number;
}

const GRID_COLS_CLASSES: Record<number, string> = {
  1: 'grid-cols-[repeat(auto-fill,16rem)]',
  2: 'grid-cols-[repeat(auto-fill,13rem)]',
  3: 'grid-cols-[repeat(auto-fill,11rem)]',
  4: 'grid-cols-[repeat(auto-fill,8rem)]',
  5: 'grid-cols-[repeat(auto-fill,6rem)]',
  6: 'grid-cols-[repeat(auto-fill,4rem)]',
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

  const gridColsClass = GRID_COLS_CLASSES[gridSize] || GRID_COLS_CLASSES[3];

  return (
    <div className={`
      grid
      gap-4
      w-full 
      animate-in fade-in
      transition-all duration-300 ease-out
      items-center justify-center
      ${gridColsClass}
    `}>
      {games.map((game) => (
        <div 
          key={game.id}
          className="w-full transition-all duration-300 ease-out"
        >
          <GameCard
            game={game}
            lastBiosUpdate={lastBiosUpdate}
            onDelete={onRefresh}
            onUpdate={onUpdate}
            gridSize={gridSize}
          />
        </div>
      ))}
    </div>
  );
}