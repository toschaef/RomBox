import { useEffect, useRef, useState } from 'react';
import type { Game } from '../../../shared/types';
import InstallModal from '../inputs/InstallModal';
import BiosModal from '../inputs/BiosModal';
import { gameClient } from '../../clients/gameClient';
import { saveClient } from '../../clients/saveClient';
import { IpcResponse } from '../../../shared/types';

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface Props {
  game: Game;
  lastBiosUpdate: string;
  onDelete: () => void;
  onUpdate: (game: Game) => void;
  gridSize?: number;
}

export default function GameCard({ game, lastBiosUpdate, onDelete, onUpdate, gridSize = 3 }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [biosModalOpen, setBiosModalOpen] = useState(false);
  const [biosMissing, setBiosMissing] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const getButtonStyle = () => {
    if (gridSize >= 6) {
      return `
        text-[10px]
        p-0.5
        h-4 w-4
        flex items-center justify-center
      `;
    }
    if (gridSize >= 4) {
      return `
        text-xs
        p-1
        h-5 w-5
        flex items-center justify-center
      `;
    }
    return `
      text-base
      font-bold
      p-1.5
      h-7 w-7
      flex items-center justify-center
    `;
  };

  const buttonClass = `
    text-fg-primary
    bg-bg-secondary
    hover:bg-bg-highlight
    border border-border-subtle
    shadow-md
    transition-all
    leading-none
    rounded-md
    ${getButtonStyle()}
  `;
  
  const getFallbackButtonStyle = () => {
    if (gridSize >= 6) {
      return `
        text-[10px]
        px-0.5 py-0
      `;
    }
    if (gridSize >= 4) {
      return `
        text-xs
        px-1 py-0.5
      `;
    }
    return `
      text-lg
      font-bold
      px-1.5 py-0.5
    `;
  };

  const fallbackButtonClass = `
    text-white/70
    hover:text-white 
    hover:bg-white/10
    transition-colors 
    leading-none
    rounded
    ${getFallbackButtonStyle()}
  `;

  // effect to close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // effect to close bios modal on upload
  useEffect(() => {
    if (biosModalOpen) {
      setBiosModalOpen(false);
    }
  }, [lastBiosUpdate]);

  // effect to fetch cover art
  useEffect(() => {
    let cancelled = false;

    const fetchCover = async () => {
      setCoverLoading(true);
      try {
        const getResult = await gameClient.getCover(game);
        if (getResult.success && getResult.coverPath) {
          if (!cancelled) {
            setCoverPath(getResult.coverPath);
            setCoverLoading(false);
          }
          return;
        }

        const fetchResult = await gameClient.fetchCover(game);
        if (!cancelled) {
          if (fetchResult.success && fetchResult.coverPath) {
            setCoverPath(fetchResult.coverPath);
          }
          setCoverLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch cover:', err);
        if (!cancelled) {
          setCoverLoading(false);
        }
      }
    };

    fetchCover();

    return () => {
      cancelled = true;
    };
  }, [game.id, game.title]);

  const handlePlay = async () => {
    try {
      const result: IpcResponse = await gameClient.launch(game);

      if (result.success) {
        console.log("Game launched without electron error");
      } else if (result.code === 'MISSING_ENGINE') {
        setInstallModalOpen(true);
      } else if (result.code === 'MISSING_BIOS') {
        setBiosMissing(result.message ?? null);
        setBiosModalOpen(true);
      } else {
        console.error("Launch error:", result.message);
      }
    } catch (err) {
      console.error("IPC Error", err);
    }
  };

  const handleUpdate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onUpdate(game);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete game ${game.title}?`)) {
      try {
        await window.electron.invoke('game:delete', game.id);
        onDelete();
      } catch (err) {
        console.error(err);
      }
    }
    setShowMenu(false);
  };

  const handleExportSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    
    try {
      console.log(`[GameCard] Exporting save for "${game.title}"...`);
      const result = await saveClient.export(game.id);
      
      if (result.success && result.exportedTo) {
        console.log(`[GameCard] Save exported to: ${result.exportedTo}`);
      } else if (result.error === 'Export cancelled') {
        console.log('[GameCard] Export cancelled by user');
      } else {
        console.warn(`[GameCard] Export failed: ${result.error}`);
      }
    } catch (err) {
      console.error('[GameCard] Export error:', err);
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const hasCover = coverPath && !coverError;

  return (
    <div
      onClick={handlePlay}
      className={`
        group
        relative
        flex flex-col
        ${hasCover ? 'w-full h-auto' : 'w-full aspect-square'}
        bg-bg-secondary
        ${hasCover ? 'border-none' : 'border border-border-subtle hover:border-border-highlight'}
        rounded-xs
        overflow-hidden
        transition-all duration-300 ease-out
        cursor-pointer
      `}
    >
      {hasCover ? (
        <div className="relative h-full w-auto group">
          <img
            src={`cover://${coverPath}`}
            alt={game.title}
            className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-101"
            draggable={false}
            onError={(e) => {
              console.error('[GameCard] Image load error:', game.title, coverPath, e);
              setCoverError(true);
            }}
          />
          {/* menu button */}
          <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="relative" ref={menuRef}>
              <button
                onClick={toggleMenu}
                className={buttonClass}
              >
                ⋮
              </button>

              {showMenu && (
                <div className="
                  absolute 
                  bottom-full 
                  right-0 
                  mb-1 
                  w-32 
                  bg-bg-primary 
                  border border-border-muted 
                  rounded-md 
                  shadow-xl 
                  z-20 
                  overflow-hidden
                  animate-in fade-in zoom-in-95 duration-100
                ">
                  <div className="
                    px-3 py-2 text-xs text-fg-muted
                    border-b border-border-subtle
                  ">
                    <span className="font-semibold">Playtime:</span>{' '}
                    {formatPlaytime(game.playtimeSeconds ?? 0)}
                  </div>
                  <button
                    onClick={handleUpdate}
                    className="
                      w-full text-left px-3 py-2 text-xs font-semibold 
                      text-fg-secondary hover:text-fg-primary hover:bg-bg-muted
                      transition-colors
                    "
                  >
                    Rename
                  </button>
                  <button
                    onClick={handleExportSave}
                    className="
                      w-full text-left px-3 py-2 text-xs font-semibold 
                      text-fg-secondary hover:text-fg-primary hover:bg-bg-muted
                      transition-colors
                    "
                  >
                    Export Save
                  </button>
                  <div className="h-px bg-border-subtle mx-1"></div>
                  <button
                    onClick={handleDelete}
                    className="
                      w-full text-left px-3 py-2 text-xs font-semibold 
                      text-red-400 hover:text-red-300 hover:bg-red-500/10
                      transition-colors
                    "
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full bg-bg-muted flex flex-col">
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="
                text-fg-muted/20
                font-black
                text-3xl
                select-none
                group-hover:text-fg-muted/30
                group-hover:scale-110
                transition-all duration-300
              ">
                {game.consoleId.toUpperCase()}
              </span>
           </div>

           <div className="flex-1"></div>
           
           <div className="
             relative z-10 
             bg-linear-to-t
             p-3 pt-6
             flex items-end justify-between
           ">
              <div className="flex-1 min-w-0 mr-2">
                 <h3 className="
                    text-white/90 
                    font-bold 
                    text-xs 
                    truncate 
                    drop-shadow-md
                    group-hover:text-white
                 ">
                   {game.title}
                 </h3>
                 <span className="
                    text-[10px] 
                    uppercase 
                    tracking-wider 
                    font-semibold 
                    text-white/60
                 ">
                   {game.consoleId}
                 </span>
              </div>

              {/* menu button */}
              <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={toggleMenu}
                    className={fallbackButtonClass}
                  >
                    ⋮
                  </button>
                   {showMenu && (
                    <div className="
                      absolute 
                      bottom-full 
                      right-0 
                      mb-1 
                      w-32 
                      bg-bg-primary 
                      border border-border-muted 
                      rounded-md 
                      shadow-xl 
                      z-20 
                      overflow-hidden
                      animate-in fade-in zoom-in-95 duration-100
                    ">
                      <div className="
                        px-3 py-2 text-xs text-fg-muted
                        border-b border-border-subtle
                      ">
                        <span className="font-semibold text-fg-primary">Playtime:</span>{' '}
                        {formatPlaytime(game.playtimeSeconds ?? 0)}
                      </div>
                      <button
                        onClick={handleUpdate}
                        className="
                          w-full text-left px-3 py-2 text-xs font-semibold 
                          text-fg-secondary hover:text-fg-primary hover:bg-bg-muted
                          transition-colors
                        "
                      >
                        Rename
                      </button>
                      <button
                        onClick={handleExportSave}
                        className="
                          w-full text-left px-3 py-2 text-xs font-semibold 
                          text-fg-secondary hover:text-fg-primary hover:bg-bg-muted
                          transition-colors
                        "
                      >
                        Export Save
                      </button>
                      <div className="h-px bg-border-subtle mx-1"></div>
                      <button
                        onClick={handleDelete}
                        className="
                          w-full text-left px-3 py-2 text-xs font-semibold 
                          text-red-400 hover:text-red-300 hover:bg-red-500/10
                          transition-colors
                        "
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
           </div>
        </div>
      )}

      {installModalOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <InstallModal
            game={game}
            onClose={() => setInstallModalOpen(false)}
            onSuccess={() => {
              setInstallModalOpen(false);
              handlePlay();
            }}
          />
        </div>
      )}
      {biosModalOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <BiosModal
            game={game}
            missing={biosMissing}
            onClose={() => setBiosModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}