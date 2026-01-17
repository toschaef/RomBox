import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Game } from '../../../shared/types';
import type { EngineID } from '../../../shared/types/engines';
import GameGrid from '../library/GameGrid';
import UpdateGameModal from '../inputs/UpdateGameModal';
import type { LayoutContextType } from '../layout';
import { gameClient } from '../../clients/gameClient';
import { CONSOLEID_ENGLISH_MAP } from '../../../shared/constants';

type SortOption = 'recent' | 'title-asc' | 'title-desc' | 'playtime-desc' | 'playtime-asc';
type GroupOption = 'none' | 'console' | 'engine';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recently Played' },
  { value: 'title-asc', label: 'A-Z' },
  { value: 'title-desc', label: 'Z-A' },
  { value: 'playtime-desc', label: 'Most Playtime' },
  { value: 'playtime-asc', label: 'Least Playtime' },
];

const GROUP_OPTIONS: { value: GroupOption; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'console', label: 'Console' },
  { value: 'engine', label: 'Engine' },
];

const ENGINE_DISPLAY_NAMES: Record<EngineID, string> = {
  'mesen': 'Mesen',
  'ares': 'Ares',
  'rmg': 'RMG',
  'melonds': 'MelonDS',
  'azahar': 'Azahar',
  'dolphin': 'Dolphin',
  'duckstation': 'DuckStation',
  'pcsx2': 'PCSX2',
};

const STORAGE_KEYS = {
  sortBy: 'rombox:library:sortBy',
  groupBy: 'rombox:library:groupBy',
  gridSize: 'rombox:library:gridSize',
};

export default function Library() {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [search, setSearch] = useState('');
  
  // load preferences from localStorage
  const [sortBy, setSortByState] = useState<SortOption>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.sortBy);
    return (saved as SortOption) || 'recent';
  });
  const [groupBy, setGroupByState] = useState<GroupOption>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.groupBy);
    return (saved as GroupOption) || 'none';
  });
  const [gridSize, setGridSizeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.gridSize);
    return saved ? parseInt(saved, 10) : 3;
  });

  const setSortBy = (value: SortOption) => {
    setSortByState(value);
    localStorage.setItem(STORAGE_KEYS.sortBy, value);
  };
  const setGroupBy = (value: GroupOption) => {
    setGroupByState(value);
    localStorage.setItem(STORAGE_KEYS.groupBy, value);
  };
  const setGridSize = (value: number | ((prev: number) => number)) => {
    setGridSizeState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      localStorage.setItem(STORAGE_KEYS.gridSize, String(newValue));
      return newValue;
    });
  };

  const { lastBiosUpdate, refreshLibraryTrigger } = useOutletContext<LayoutContextType>();

  const fetchGames = async () => {
    try {
      const result = await gameClient.getAll();
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

  // listen for refresh trigger
  useEffect(() => {
    if (refreshLibraryTrigger > 0) {
      fetchGames();
    }
  }, [refreshLibraryTrigger]);

  // listen for game exit to refresh playtime
  useEffect(() => {
    const unsubscribe = window.electron.on?.('game-exited', () => {
      fetchGames();
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const sortedGames = useMemo(() => {
    const sorted = [...games];
    switch (sortBy) {
      case 'recent':
        sorted.sort((a, b) => {
          const aTime = a.lastPlayedAt ?? 0;
          const bTime = b.lastPlayedAt ?? 0;
          return bTime - aTime;
        });
        break;
      case 'title-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'playtime-desc':
        sorted.sort((a, b) => (b.playtimeSeconds ?? 0) - (a.playtimeSeconds ?? 0));
        break;
      case 'playtime-asc':
        sorted.sort((a, b) => (a.playtimeSeconds ?? 0) - (b.playtimeSeconds ?? 0));
        break;
    }
    return sorted;
  }, [games, sortBy]);

  const filteredGames = useMemo(() => {
    if (!search.trim()) return sortedGames;
    const term = search.toLowerCase();
    return sortedGames.filter(g => g.title.toLowerCase().includes(term));
  }, [sortedGames, search]);

  const groupedGames = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Games': filteredGames };
    }

    const groups: Record<string, Game[]> = {};
    for (const game of filteredGames) {
      let key: string;
      if (groupBy === 'console') {
        key = CONSOLEID_ENGLISH_MAP[game.consoleId] || game.consoleId;
      } else {
        key = ENGINE_DISPLAY_NAMES[game.engineId] || game.engineId;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(game);
    }

    const sortedGroups: Record<string, Game[]> = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });
    return sortedGroups;
  }, [filteredGames, groupBy]);

  return (
    <div
      className="
        flex flex-col items-center min-h-screen p-8 transition-colors duration-200
        bg-bg-primary text-fg-primary
      "
    >
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold py-4 text-fg-primary shrink-0">Games</h1>
        
        
        <div className="flex items-center gap-4 shrink-0">
          {/* search bar */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="
              bg-bg-secondary text-fg-primary text-sm
              border border-border-subtle rounded-md
              px-3 py-1.5 w-full sm:w-40 md:w-56 lg:w-56
              placeholder:text-fg-muted
              hover:border-border-highlight
              focus:border-accent-primary focus:outline-none
              transition-colors
            "
          />
          {/* sort by */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-fg-muted font-medium">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="
                bg-bg-secondary text-fg-primary text-sm
                border border-border-subtle rounded-md
                px-3 py-1.5
                hover:border-border-highlight
                focus:border-accent-primary focus:outline-none
                transition-colors cursor-pointer
              "
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* group by */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-fg-muted font-medium">Group:</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupOption)}
              className="
                bg-bg-secondary text-fg-primary text-sm
                border border-border-subtle rounded-md
                px-3 py-1.5
                hover:border-border-highlight
                focus:border-accent-primary focus:outline-none
                transition-colors cursor-pointer
              "
            >
              {GROUP_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* grid size */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setGridSize(s => Math.max(1, s - 1))}
              disabled={gridSize <= 1}
              className="
                w-7 h-7 flex items-center justify-center
                bg-bg-secondary text-fg-primary text-sm font-bold
                border border-border-subtle rounded-md
                hover:border-border-highlight hover:bg-bg-muted
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              +
            </button>
            <button
              onClick={() => setGridSize(s => Math.min(6, s + 1))}
              disabled={gridSize >= 7}
              className="
                w-7 h-7 flex items-center justify-center
                bg-bg-secondary text-fg-primary text-sm font-bold
                border border-border-subtle rounded-md
                hover:border-border-highlight hover:bg-bg-muted
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              −
            </button>
          </div>
        </div>
      </div>

      {/* groups */}
      {Object.entries(groupedGames).map(([groupName, groupGames]) => (
        <div key={groupName} className="w-full mb-8 items-center">
          {groupBy !== 'none' && (
            <h2 className={`
              font-semibold text-fg-secondary mb-4 
              border-b border-border-subtle pb-2
              transition-all
              ${gridSize === 1 ? 'text-2xl' : gridSize === 2 ? 'text-xl' : gridSize === 3 ? 'text-lg' : 'text-base'}
            `}>
              {groupName}
              <span className={`ml-2 text-fg-muted font-normal ${gridSize <= 2 ? 'text-sm' : 'text-xs'}`}>
                ({groupGames.length})
              </span>
            </h2>
          )}
          <GameGrid
            games={groupGames}
            onRefresh={fetchGames}
            onUpdate={(game: Game) => setEditingGame(game)}
            lastBiosUpdate={lastBiosUpdate}
            gridSize={gridSize}
          />
        </div>
      ))}

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