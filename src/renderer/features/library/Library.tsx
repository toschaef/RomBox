import { useEffect, useMemo, useState } from 'react';
import type { Game } from '../../../shared/types';
import GameGrid from './GameGrid';
import SearchBar from './SearchBar';
import SortSelect, { type SortOption } from './SortSelect';
import GroupSelect, { type GroupOption } from './GroupSelect';
import GridSizeControl, { GRID_SIZE_MIN, GRID_SIZE_MAX } from './GridSizeControl';
import UpdateGameModal from './UpdateGameModal';
import { PageLayout } from '../../ui';
import { useLayoutContext } from '../../app/layoutContext';
import { gameClient } from '../../clients/gameClient';
import { CONSOLEID_ENGLISH_MAP, getEmulatorNameFromEngineId } from '../../../shared/emulators/derived';
import ImportButton from './ImportButton';
import { usePersistedState, boolCodec, intCodec, enumCodec } from '../../hooks/usePersistedState';
import { PREFERENCE_KEYS, PREFERENCE_DEFAULTS } from '../../preferences';

export default function Library() {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [search, setSearch] = useState('');

  const [sortBy, setSortBy] = usePersistedState<SortOption>(
    PREFERENCE_KEYS.sortBy,
    PREFERENCE_DEFAULTS.sortBy,
    enumCodec<SortOption>()
  );
  const [groupBy, setGroupBy] = usePersistedState<GroupOption>(
    PREFERENCE_KEYS.groupBy,
    PREFERENCE_DEFAULTS.groupBy,
    enumCodec<GroupOption>()
  );
  const [gridSize, setGridSize] = usePersistedState(PREFERENCE_KEYS.gridSize, PREFERENCE_DEFAULTS.gridSize, intCodec);
  const [alignGames] = usePersistedState(PREFERENCE_KEYS.alignGames, PREFERENCE_DEFAULTS.alignGames, boolCodec);

  const { lastBiosUpdate, refreshLibraryTrigger, importFilePaths } = useLayoutContext();

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

  useEffect(() => {
    if (refreshLibraryTrigger > 0) {
      fetchGames();
    }
  }, [refreshLibraryTrigger]);

  // refresh playtime on exit
  useEffect(() => {
    const unsubscribe = gameClient.onExited(() => {
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
        sorted.sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
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

    const term = search.toLowerCase().replace(/[\s-]+/g, '');

    return sortedGames.filter(g => {
      const title = g.title.toLowerCase();
      const cleanTitle = title.replace(/[\s-]+/g, '');
      const tokens = title.split(/[\s-]+/).filter(Boolean);
      const acronym = tokens
        .map(token => (/^\d+$/.test(token) ? token : token[0]))
        .join('');

      return cleanTitle.includes(term) || acronym.startsWith(term);
    });
  }, [sortedGames, search]);

  const groupedGames = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Games': filteredGames };
    }

    const groups: Record<string, Game[]> = {};
    for (const game of filteredGames) {
      const key =
        groupBy === 'console'
          ? CONSOLEID_ENGLISH_MAP[game.consoleId] || game.consoleId
          : getEmulatorNameFromEngineId(game.engineId) || game.engineId;
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
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setGridSize(s => Math.max(GRID_SIZE_MIN, s - 1));
      } else if (e.key === '-') {
        e.preventDefault();
        setGridSize(s => Math.min(GRID_SIZE_MAX, s + 1));
      } else if (e.key === '0') {
        e.preventDefault();
        setGridSize(PREFERENCE_DEFAULTS.gridSize);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setGridSize]);

  return (
    <PageLayout
      title="Games"
      actions={
        <div className="flex items-center gap-4">
          <ImportButton onImport={importFilePaths} />
          <SearchBar value={search} onChange={setSearch} />
          <SortSelect value={sortBy} onChange={setSortBy} />
          <GroupSelect value={groupBy} onChange={setGroupBy} />
          <GridSizeControl value={gridSize} onChange={setGridSize} />
        </div>
      }
    >
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
            alignGames={alignGames}
          />
        </div>
      ))}

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