import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Game } from '../../../shared/types';
import type { EngineID } from '../../../shared/types/engines';
import GameGrid from '../library/GameGrid';
import SearchBar from '../library/SearchBar';
import SortSelect, { type SortOption } from '../library/SortSelect';
import GroupSelect, { type GroupOption } from '../library/GroupSelect';
import GridSizeControl from '../library/GridSizeControl';
import UpdateGameModal from '../inputs/UpdateGameModal';
import PageLayout from '../layout/PageLayout';
import type { LayoutContextType } from '../layout';
import { gameClient } from '../../clients/gameClient';
import { CONSOLEID_ENGLISH_MAP } from '../../../shared/constants';

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
    const term = search.toLowerCase().replace(/\s+/g, '');
    return sortedGames.filter(g => {
      const title = g.title.toLowerCase();
      const titleNoSpaces = title.replace(/\s+/g, '');
      const acronym = title.split(/\s+/).map(w => w[0]).filter(Boolean).join('');
      return title.includes(search.toLowerCase())
        || titleNoSpaces.includes(term)
        || acronym.startsWith(term);
    });
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setGridSize(s => Math.max(1, s - 1));
        } else if (e.key === '-') {
          e.preventDefault();
          setGridSize(s => Math.min(6, s + 1));
        } else if (e.key === '0') {
          e.preventDefault();
          setGridSize(3);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <PageLayout
      title="Games"
      actions={
        <div className="flex items-center gap-4">
          <SearchBar value={search} onChange={setSearch} />
          <SortSelect value={sortBy} onChange={setSortBy} />
          <GroupSelect value={groupBy} onChange={setGroupBy} />
          <GridSizeControl value={gridSize} onChange={setGridSize} />
        </div>
      }
    >
      {/* groups */}
      {Object.entries(groupedGames).map(([groupName, groupGames]) => (
        <div key={groupName} className="w-full mb-8">
          {groupBy !== 'none' && (
            <h2 className={`
              font-semibold text-fg-secondary mb-4 
              border-b border-border-subtle pb-2
              uppercase tracking-wide
              ${gridSize === 1 ? 'text-xl' : gridSize === 2 ? 'text-lg' : 'text-base'}
            `}>
              {groupName}
              <span className="ml-2 text-fg-muted font-normal text-xs opacity-70">
                [{groupGames.length}]
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
    </PageLayout>
  );
}