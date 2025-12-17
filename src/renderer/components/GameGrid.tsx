import type { Game } from '../../shared/types';
import GameCard from './cards/GameCard';

interface Props {
  games: Game[];
  onRefresh: () => void;
  onUpdate: (game: Game) => void;
}

export default function GameGrid({ games, onRefresh, onUpdate }: Props) {
  if (games.length === 0) {
    return null;
  }

  return (
    <div className="
      grid 
      grid-cols-3
      sm:grid-cols-4 
      lg:grid-cols-5 
      xl:grid-cols-6 
      gap-6 
      w-full 
      animate-in fade-in duration-500
    ">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onDelete={onRefresh}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}