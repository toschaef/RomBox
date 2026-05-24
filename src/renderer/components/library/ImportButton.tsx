import * as React from 'react';

interface ImportButtonProps {
  onImport: (filePaths: string[]) => void;
}

export default function ImportButton({ onImport }: ImportButtonProps) {
  const handleClick = async () => {
    try {
      const filePaths = await window.electron.invoke('select-files-or-directories') as string[];
      if (filePaths && filePaths.length > 0) {
        onImport(filePaths);
      }
    } catch (err) {
      console.error('Failed to open select dialog:', err);
    }
  };

  return (
    <button
      onClick={handleClick}
      data-testid="import-button"
      id="manual-import-button"
      className="
        bg-accent-secondary
        text-white text-xs font-semibold uppercase tracking-wider
        border border-accent-secondary rounded-none
        px-3 py-1.5 h-fit self-center shrink-0
        hover:bg-accent-primary
        focus:outline-none
        transition-all cursor-pointer
      "
    >
      + Add File(s)
    </button>
  );
}
