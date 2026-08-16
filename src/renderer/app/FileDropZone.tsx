import { ReactNode } from 'react';
import { useDragAndDrop } from './useDragAndDrop';

interface FileDropZoneProps {
  onFilesDropped: (files: FileList) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}

export default function FileDropZone({ onFilesDropped, children, className }: FileDropZoneProps) {
  const { isDragging, dragProps } = useDragAndDrop((files) => void onFilesDropped(files));

  return (
    <div {...dragProps} className={className}>
      {isDragging && (
        <div
          data-testid="file-drop-overlay"
          className="absolute inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
        >
          <div className="text-center animate-pulse">
            <h2 className="text-5xl font-bold text-accent-primary mb-2">Drop File</h2>
            <p className="text-xl text-fg-muted">Add Game or Install BIOS</p>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
