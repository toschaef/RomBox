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

const COLUMN_WIDTHS_REM: Record<number, number> = { 1: 16, 2: 13, 3: 11, 4: 8, 5: 6, 6: 4 };
const REM_PX = 16;
const GAP_PX = 16;
const BATCH_SIZE = 50;

const columnWidthRem = (gridSize: number) => COLUMN_WIDTHS_REM[gridSize] ?? COLUMN_WIDTHS_REM[3];
const columnWidthPx = (gridSize: number) => columnWidthRem(gridSize) * REM_PX;

export default function GameGrid({
  games,
  lastBiosUpdate,
  onRefresh,
  onUpdate,
  gridSize = 3,
  alignGames = false
}: Props) {
  const [displayedCount, setDisplayedCount] = useState(BATCH_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.max(200, window.innerWidth - 304) : 800
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width);
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

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [games.length]);

  const visibleGames = useMemo(() => games.slice(0, displayedCount), [games, displayedCount]);

  const colsCount = Math.max(1, Math.floor((containerWidth + GAP_PX) / (columnWidthPx(gridSize) + GAP_PX)));

  const columns = useMemo(() => {
    const cols: Game[][] = Array.from({ length: colsCount }, (): Game[] => []);
    visibleGames.forEach((game, index) => {
      cols[index % colsCount].push(game);
    });
    return cols;
  }, [visibleGames, colsCount]);

  if (games.length === 0) return null;

  const card = (game: Game) => (
    <div key={game.id} className="w-full transition-all duration-slow ease-out">
      <GameCard
        game={game}
        lastBiosUpdate={lastBiosUpdate}
        onRefresh={onRefresh}
        onUpdate={onUpdate}
        gridSize={gridSize}
      />
    </div>
  );

  const sentinel =
    displayedCount < games.length ? (
      <div ref={observerTarget} className="h-20 w-full flex items-center justify-center opacity-50 text-sm italic">
        Loading
      </div>
    ) : null;

  return (
    <>
      {alignGames ? (
        <div
          ref={containerRef}
          className="grid gap-4 w-full animate-in fade-in transition-all duration-slow ease-out items-center justify-center"
          style={{ gridTemplateColumns: `repeat(auto-fill, ${columnWidthRem(gridSize)}rem)` }}
        >
          {visibleGames.map(card)}
        </div>
      ) : (
        <div ref={containerRef} className="w-full flex gap-4 animate-in fade-in transition-all duration-slow ease-out">
          {columns.map((colGames, colIndex) => (
            <div key={colIndex} className="flex-1 flex flex-col gap-4 min-w-0">
              {colGames.map(card)}
            </div>
          ))}
        </div>
      )}

      {sentinel}
    </>
  );
}
