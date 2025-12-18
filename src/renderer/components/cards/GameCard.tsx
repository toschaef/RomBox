import { useEffect, useRef, useState } from 'react';
import type { Game } from '../../../shared/types';
import InstallModal from '../inputs/InstallModal';
import BiosModal from '../inputs/BiosModal';

interface Props {
  game: Game;
  lastBiosUpdate: string;
  onDelete: () => void;
  onUpdate: (game: Game) => void;
}

export default function GameCard({ game, lastBiosUpdate, onDelete, onUpdate }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [biosModalOpen, setBiosModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // hook to close bios modal on upload
  useEffect(() => {
    if (biosModalOpen) {
      setBiosModalOpen(false);
    }
  }, [lastBiosUpdate]);
  
  const handlePlay = async () => {
    try {
      const result = await window.electron.invoke('play-game', game);
      
      if (result.success) {
        console.log("Game launched without electron error");
      } else if (result.code === 'MISSING_ENGINE') {
          setInstallModalOpen(true);
      } else if (result.code === 'MISSING_BIOS') {
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
            await window.electron.invoke('delete-game', game.id);
            onDelete();
        } catch(err) {
            console.error(err);
        }
    }
    setShowMenu(false);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  return (
    <div 
      onClick={handlePlay}
      className="
        group
        relative
        flex flex-col
        w-full
        bg-bg-secondary
        border border-border-subtle
        hover:border-border-highlight
        rounded-md
        p-3
        transition-all duration-300 ease-out
        cursor-pointer
        hover:shadow-[0_0_20px_rgba(139,92,246,0.2)]
      "
    >
      {/* box */}
      <div className="
        aspect-4/3
        bg-bg-muted
        rounded-lg
        mb-3 
        flex items-center justify-center
        overflow-hidden
        border border-transparent
        group-hover:border-border-muted/50
        transition-colors
      ">
        <span className="
          text-fg-muted
          font-mono
          text-sm
          group-hover:text-fg-primary
          group-hover:scale-110
          transition-all duration-300
        ">
          {game.consoleId.toUpperCase()}
        </span>
      </div>

      {/* metadata */}
      <div className="flex flex-col gap-1">
        <h3 className="
          text-fg-primary 
          font-bold 
          text-sm 
          truncate 
          group-hover:text-accent-secondary 
          transition-colors
        ">
          {game.title}
        </h3>
        
        <div className="flex justify-between items-center relative">
          <span className="
            text-[10px] 
            uppercase 
            tracking-wider 
            font-semibold 
            text-fg-muted 
            bg-bg-primary/50 
            px-2 py-0.5 
            rounded
          ">
            {game.consoleId}
          </span>

          {/* menu button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={toggleMenu}
              className="
                text-fg-muted
                hover:text-accent-primary 
                transition-colors 
                text-lg
                font-bold
                px-2
                leading-none
                rounded
                hover:bg-bg-muted
              "
            >
              ⋮
            </button>

            {/* Popup Menu */}
            {showMenu && (
              <div className="
                absolute 
                bottom-full 
                right-0 
                mb-1 
                w-24 
                bg-bg-primary 
                border border-border-muted 
                rounded-md 
                shadow-xl 
                z-20 
                overflow-hidden
                animate-in fade-in zoom-in-95 duration-100
              ">
                <button 
                  onClick={handleUpdate}
                  className="
                    w-full text-left px-3 py-2 text-xs font-semibold 
                    text-fg-secondary hover:text-fg-primary hover:bg-bg-muted
                    transition-colors
                  "
                >
                  Update
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
            onClose={() => setBiosModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}