import type { Game } from '../../shared/types';
import GameCard from './cards/GameCard';

interface Props {
  games: Game[];
  lastBiosUpdate: string;
  onRefresh: () => void;
  onUpdate: (game: Game) => void;
}

export default function GameGrid({ 
  games, 
  lastBiosUpdate, 
  onRefresh, 
  onUpdate 
}: Props) {
  if (games.length === 0) {
    return null;
  }

  return (
    <div className="
      grid 
      grid-cols-2
      sm:grid-cols-3
      lg:grid-cols-4 
      xl:grid-cols-5 
      gap-6 
      w-full 
      animate-in fade-in duration-500
    ">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          lastBiosUpdate={lastBiosUpdate}
          onDelete={onRefresh}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}