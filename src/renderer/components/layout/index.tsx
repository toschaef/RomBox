import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { ScanResponse } from '../../../shared/types';

export interface LayoutContextType {
  lastBiosUpdate: string | null;
  refreshLibraryTrigger: number;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalStatus: (message: string) => void;
}

const PAGES = [
  "", // Libary
  "Controls",
  "Engines",
  "Bios",
  "Settings",
]

export default function Layout() {
  const [lastBiosUpdate, setLastBiosUpdate] = useState<string | null>(null);
  const [refreshLibraryTrigger, setRefreshLibraryTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Processing");

  const setGlobalLoading = (l: boolean) => setIsLoading(l);
  const setGlobalStatus = (s: string) => setLoadingMessage(s);

  const onFilesDropped = async (files: FileList) => {
    setIsLoading(true);
    setLoadingMessage("Installing");

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = window.electron.getPathForFile(file);

        if (files.length > 1) setLoadingMessage(`Processing ${i + 1} of ${files.length}...`);
        
        try {
          const result: {success: boolean, games: ScanResponse[], biosCount: number, message?: string } = await window.electron.invoke('process-file-drop', filePath);
          console.log('Drop Result:', result);
          
          if (result.success) {
            if (result.games && result.games.length > 0) {
              setRefreshLibraryTrigger(prev => prev + 1);
            }
            if (result.biosCount && result.biosCount > 0) {
              setLastBiosUpdate(Date.now().toString());
            }
          } else {
            console.warn("File drop issue:", result.message);
          }
        } catch (err) {
          console.error("IPC Error:", err);
        } finally {
          setIsLoading(false);
        }
    }
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

      {/* loading modal */}
      {isLoading && (
        <div className="absolute inset-0 z-110 flex flex-col items-center justify-center bg-bg-primary/80 backdrop-blur-md cursor-wait overflow-hidden">
          <svg className="animate-spin h-12 w-12 text-accent-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          
          <div className="z-10 flex flex-col items-center">
             <h2 className="text-3xl font-black text-transparent bg-clip-text bg-linear-to-r from-accent-primary to-accent-secondary animate-pulse drop-shadow-md">{loadingMessage}</h2>
             <p className="text-sm text-fg-primary mt-2 font-bold drop-shadow-md">Large files may take a while to unzip.</p>
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
        <Outlet context={{ lastBiosUpdate, refreshLibraryTrigger, setGlobalLoading, setGlobalStatus } as LayoutContextType} />
      </main>
    </div>
  );
}