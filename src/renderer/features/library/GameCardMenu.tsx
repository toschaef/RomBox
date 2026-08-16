import { useState } from 'react';
import { useDismissable } from '../../hooks/useDismissable';
import { IconButton, Menu, MenuItem, MenuLabel, MenuSeparator } from '../../ui';
import type { GameCardDensity } from './density';
import { menuButtonSize } from './density';

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

type Props = {
  playtimeSeconds: number;
  density: GameCardDensity;
  onCover: boolean;
  onRename: () => void;
  onExportSave: () => void;
  onImportSave: () => void;
  onDelete: () => void;
};

export default function GameCardMenu({
  playtimeSeconds,
  density,
  onCover,
  onRename,
  onExportSave,
  onImportSave,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const { triggerRef, panelRef } = useDismissable<HTMLButtonElement, HTMLDivElement>(open, () => setOpen(false));

  const close = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <div className="relative">
      <IconButton
        ref={triggerRef}
        data-testid="game-menu-button"
        aria-label="Game options"
        aria-expanded={open}
        intent={onCover ? 'default' : 'ghost'}
        size={menuButtonSize(density)}
        className={onCover ? 'shadow-card' : ''}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {'⋮'}
      </IconButton>

      {open && (
        <Menu panelRef={panelRef} side="top" width="sm">
          <MenuLabel>
            <span className="font-semibold text-fg-primary">Playtime:</span> {formatPlaytime(playtimeSeconds)}
          </MenuLabel>
          <MenuItem size="sm" onClick={close(onRename)}>
            Rename
          </MenuItem>
          <MenuItem size="sm" data-testid="export-save" onClick={close(onExportSave)}>
            Export Save
          </MenuItem>
          <MenuItem size="sm" data-testid="import-save" onClick={close(onImportSave)}>
            Import Save
          </MenuItem>
          <MenuSeparator />
          <MenuItem size="sm" intent="danger" data-testid="delete-game" onClick={close(onDelete)}>
            Delete
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
