import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useNotifications } from '../../hooks/useNotifications';
import type { DropResult } from '../../../shared/types';

export interface LayoutContextType {
  lastBiosUpdate: string | null;
  refreshLibraryTrigger: number;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalStatus: (message: string) => void;
  importFiles: (files: FileList) => Promise<void>;
  importFilePaths: (filePaths: string[]) => Promise<void>;
}

const PAGES = [
  "", // Library
  "Controls",
  "Engines",
  "Bios",
  "Settings",
]

export default function Layout() {
  const [lastBiosUpdate, setLastBiosUpdate] = useState<string | null>(null);
  const [refreshLibraryTrigger, setRefreshLibraryTrigger] = useState(0);

  const { notify, setLoadingMessage } = useNotifications();

  const setGlobalLoadingState = (l: boolean) => setLoadingMessage(l ? "Processing" : null);
  const setGlobalStatus = (s: string) => setLoadingMessage(s);
  const importFilePaths = async (filePaths: string[]) => {
    setLoadingMessage("Installing");

    let anyGames = false;
    let anyBios = false;

    const allGameTitles: string[] = [];
    const BiosLabels: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        if (filePaths.length > 1) setLoadingMessage(`Processing ${i + 1} of ${filePaths.length}...`);
        
        try {
          const result = await window.electron.invoke('process-file-drop', filePath) as DropResult;
          console.log('Drop Result:', result);
          
          if (result.success) {
            if (result.games?.length > 0) {
              anyGames = true;
              for (const g of result.games) allGameTitles.push(g.title);
            }
            if (result.biosCount > 0) {
              anyBios = true;
              if (result.biosLabels) BiosLabels.push(...result.biosLabels);
            }
          } else {
            const fileName = filePath.split(/[/\\]/).pop() || 'file';
            const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '(none)';
            errors.push(result.message ?? `Unknown extension ${ext}`);
          }
        } catch (err) {
          console.error("IPC Error:", err);
          const fileName = filePath.split(/[/\\]/).pop() || 'file';
          errors.push((err as Error).message ?? `Failed to process ${fileName}`);
        }
    }

    if (anyGames) setRefreshLibraryTrigger(prev => prev + 1);
    if (anyBios) setLastBiosUpdate(Date.now().toString());
    setLoadingMessage(null);

    const totalItems = allGameTitles.length + BiosLabels.length + errors.length;

    if (totalItems <= 3) {
      for (const title of allGameTitles) {
        notify(`Installed ${title}`, { type: 'success' });
      }
      for (const label of BiosLabels) {
        notify(`Installed ${label}`, { type: 'success' });
      }
      for (const err of errors) {
        notify(err, { type: 'error' });
      }
    } else {
      const successCount = allGameTitles.length + BiosLabels.length;
      if (successCount > 0) {
        const parts: string[] = [];
        if (allGameTitles.length > 0) parts.push(`${allGameTitles.length} game${allGameTitles.length > 1 ? 's' : ''}`);
        if (BiosLabels.length > 0) parts.push(`${BiosLabels.length} BIOS file${BiosLabels.length > 1 ? 's' : ''}`);
        notify(`Installed ${parts.join(' and ')}`, { type: 'success' });
      }
      if (errors.length > 0) {
        notify(`${errors.length} file${errors.length > 1 ? 's' : ''} failed: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '…' : ''}`, { type: 'error' });
      }
    }
  };

  const onFilesDropped = async (files: FileList) => {
    console.log("[E2E DIAGNOSTIC] onFilesDropped called with files length:", files.length);
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let filePath = '';
      try {
        filePath = window.electron.getPathForFile(file);
      } catch (err) {
        console.log("[E2E DIAGNOSTIC] getPathForFile threw:", err);
      }
      if (!filePath) {
        filePath = (file as File & { path?: string }).path || '';
      }
      if (filePath) paths.push(filePath);
    }
    await importFilePaths(paths);
  };

  const { isDragging, dragProps } = useDragAndDrop(onFilesDropped);

  return (
    <div 
      {...dragProps}
      className="flex h-screen w-full bg-bg-primary text-fg-primary font-sans relative"
    >
      {/* file drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="text-center animate-pulse">
            <h2 className="text-5xl font-bold text-accent-primary mb-2">Drop File</h2>
            <p className="text-xl text-fg-muted">Add Game or Install BIOS</p>
          </div>
        </div>
      )}

      {/* sidebar */}
      <aside className="w-64 flex flex-col border-r border-border-subtle bg-bg-secondary/30">
        <div className="p-6">
          <div className="text-2xl font-black font-stretch-expanded tracking-wide text-transparent bg-clip-text bg-linear-to-r from-accent-primary to-accent-secondary">
            RomBox
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {PAGES.map((p) =>
            <NavLink 
              to={`/${p.toLowerCase()}`}
              key={p}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 border-l-2 transition-all font-semibold
                ${isActive 
                  ? 'bg-bg-muted text-fg-primary border-accent-primary' 
                  : 'text-fg-muted border-transparent hover:bg-bg-muted hover:text-fg-primary hover:border-border-muted'}
              `}
            >
              {p || "Library"}
            </NavLink>
          )}
        </nav>

        <div className="p-6 text-xs text-fg-muted opacity-50 text-center">
          <a href="https://github.com/toschaef/RomBox" target="_blank" rel="noreferrer" className="underline hover:text-fg-primary">
            Codebase
          </a>  
        </div>
      </aside>

      <main className="flex-1 min-h-0 overflow-y-auto relative">
        <Outlet context={{ 
          lastBiosUpdate, 
          refreshLibraryTrigger, 
          setGlobalLoading: setGlobalLoadingState, 
          setGlobalStatus,
          importFiles: onFilesDropped,
          importFilePaths
        } as LayoutContextType} />
      </main>
    </div>
  );
}