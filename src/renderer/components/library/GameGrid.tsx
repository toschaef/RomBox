import { useState, useRef, useEffect, useMemo } from 'react';
import type { Game } from '../../../shared/types';
import GameCard from './GameCard';

interface Props {
  games: Game[];
  lastBiosUpdate: string;
  onRefresh: () => void;
  onUpdate: (game: Game) => void;
  gridSize?: number;
  alignGames?: boolean;
}

const GRID_COLS_CLASSES: Record<number, string> = {
  1: 'grid-cols-[repeat(auto-fill,16rem)]',
  2: 'grid-cols-[repeat(auto-fill,13rem)]',
  3: 'grid-cols-[repeat(auto-fill,11rem)]',
  4: 'grid-cols-[repeat(auto-fill,8rem)]',
  5: 'grid-cols-[repeat(auto-fill,6rem)]',
  6: 'grid-cols-[repeat(auto-fill,4rem)]',
};

const COL_WIDTH_PX: Record<number, number> = {
  1: 256,
  2: 208,
  3: 176,
  4: 128,
  5: 96,
  6: 64,
};

const BATCH_SIZE = 50;

export default function GameGrid({ 
  games, 
  lastBiosUpdate, 
  onRefresh, 
  onUpdate,
  gridSize = 3,
  alignGames = true
}: Props) {
  const [displayedCount, setDisplayedCount] = useState(BATCH_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.max(200, window.innerWidth - 304);
    }
    return 800;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setDisplayedCount(BATCH_SIZE);
  }, [games]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayedCount((prev) => Math.min(prev + BATCH_SIZE, games.length));
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [games.length]);

  const visibleGames = useMemo(() => games.slice(0, displayedCount), [games, displayedCount]);

  const targetColWidth = COL_WIDTH_PX[gridSize] || COL_WIDTH_PX[3];
  const gap = 16;
  const colsCount = Math.max(1, Math.floor((containerWidth + gap) / (targetColWidth + gap)));

  const columns = useMemo(() => {
    const cols: Game[][] = Array.from({ length: colsCount }, (): Game[] => []);
    visibleGames.forEach((game, index) => {
      const colIndex = index % colsCount;
      cols[colIndex].push(game);
    });
    return cols;
  }, [visibleGames, colsCount]);

  if (games.length === 0) {
    return null;
  }

  const gridColsClass = GRID_COLS_CLASSES[gridSize] || GRID_COLS_CLASSES[3];

  if (!alignGames) {
    return (
      <>
        <div 
          ref={containerRef}
          className="w-full flex gap-4 animate-in fade-in transition-all duration-300 ease-out"
        >
          {columns.map((colGames, colIndex) => (
            <div 
              key={colIndex} 
              className="flex-1 flex flex-col gap-4"
              style={{ minWidth: 0 }}
            >
              {colGames.map((game) => (
                <div key={game.id} className="w-full transition-all duration-300 ease-out">
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
          ))}
        </div>
        
        {displayedCount < games.length && (
          <div ref={observerTarget} className="h-20 w-full flex items-center justify-center opacity-50 text-sm italic">
             Loading
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={`
        grid
        gap-4
        w-full 
        animate-in fade-in
        transition-all duration-300 ease-out
        items-center justify-center
        ${gridColsClass}
      `}>
        {visibleGames.map((game) => (
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
      
      {displayedCount < games.length && (
        <div ref={observerTarget} className="h-20 w-full flex items-center justify-center opacity-50 text-sm italic">
           Loading
        </div>
      )}
    </>
  );
}