import { useEffect, useState } from 'react';
import type { Game } from '../../../shared/types';
import InstallModal from './InstallModal';
import BiosModal from './BiosModal';
import LocateGameModal from './LocateGameModal';
import { ConfirmModal, Pill } from '../../ui';
import { useGameCover } from './useGameCover';
import { useGameActions } from './useGameActions';
import GameCardMenu from './GameCardMenu';
import { densityFor } from './density';

interface Props {
  game: Game;
  lastBiosUpdate: string;
  onRefresh: () => void;
  onUpdate: (game: Game) => void;
  gridSize?: number;
}

export default function GameCard({ game, lastBiosUpdate, onRefresh, onUpdate, gridSize = 3 }: Props) {
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [biosModalOpen, setBiosModalOpen] = useState(false);
  const [locateModalOpen, setLocateModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [biosMissing, setBiosMissing] = useState<string | null>(null);

  const { cardRef, coverPath, hasCover, onCoverError } = useGameCover(game);
  const { launch, remove, exportSave, importSave } = useGameActions(game, { onRefresh });

  const density = densityFor(gridSize);

  // any bios upload anywhere closes modal
  useEffect(() => {
    if (biosModalOpen) setBiosModalOpen(false);
  }, [lastBiosUpdate]);

  const handlePlay = async () => {
    const { outcome, biosMissing: missing } = await launch();
    if (outcome === 'needs-engine') setInstallModalOpen(true);
    else if (outcome === 'needs-bios') {
      setBiosMissing(missing ?? null);
      setBiosModalOpen(true);
    } else if (outcome === 'missing-file') setLocateModalOpen(true);
  };

  return (
    <div
      ref={cardRef}
      onClick={handlePlay}
      className={`
        group relative flex flex-col w-full
        ${hasCover ? 'h-auto border-none' : 'aspect-square border border-border-subtle hover:border-border-highlight'}
        bg-bg-secondary rounded-xs
        transition-all duration-slow ease-out cursor-pointer
      `}
    >
      <div className="relative w-full h-full overflow-hidden rounded-xs">
        {hasCover && coverPath ? (
          <div className="relative h-full w-auto">
            <img
              src={`cover:///${coverPath.replace(/\\/g, '/').replace(/^\/+/, '')}`}
              alt={game.title}
              className="w-full h-auto object-contain transition-transform duration-slow group-hover:scale-101"
              draggable={false}
              onError={onCoverError}
            />
          </div>
        ) : (
          <div className="relative w-full h-full bg-bg-muted flex flex-col">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-fg-muted/20 font-black text-3xl select-none group-hover:text-fg-muted/30 group-hover:scale-110 transition-all duration-slow">
                {game.consoleId.toUpperCase()}
              </span>
            </div>

            <div className="flex-1" />

            <div className="relative z-raised bg-linear-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 w-full">
              <div className="w-full pr-8">
                <h3 className="text-white/90 font-bold text-xs truncate drop-shadow-md group-hover:text-white">
                  {game.title}
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-white/60">
                  {game.consoleId}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {game.fileMissing && (
        <Pill
          tone="danger"
          size="sm"
          data-testid="game-missing-badge"
          title={`File not found: ${game.filePath}`}
          className="absolute z-elevated top-2 left-2 shadow-card"
        >
          Missing
        </Pill>
      )}

      <div
        className={`
          absolute z-elevated
          ${hasCover ? 'opacity-0 group-hover:opacity-100 bottom-2 right-2' : 'bottom-3 right-3'}
          transition-opacity duration-base
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <GameCardMenu
          playtimeSeconds={game.playtimeSeconds ?? 0}
          density={density}
          onCover={!!hasCover}
          onRename={() => onUpdate(game)}
          onExportSave={() => void exportSave()}
          onImportSave={() => void importSave()}
          onDelete={() => setConfirmDeleteOpen(true)}
        />
      </div>

      {confirmDeleteOpen && (
        <ConfirmModal
          destructive
          title={`Delete ${game.title}?`}
          description="The game is removed from your library. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => void remove()}
          onClose={() => setConfirmDeleteOpen(false)}
        />
      )}

      {installModalOpen && (
        <InstallModal
          game={game}
          onClose={() => setInstallModalOpen(false)}
          onSuccess={() => {
            setInstallModalOpen(false);
            void handlePlay();
          }}
        />
      )}

      {biosModalOpen && (
        <BiosModal game={game} missing={biosMissing} onClose={() => setBiosModalOpen(false)} />
      )}

      {locateModalOpen && (
        <LocateGameModal
          game={game}
          onClose={() => setLocateModalOpen(false)}
          onSuccess={() => {
            setLocateModalOpen(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
