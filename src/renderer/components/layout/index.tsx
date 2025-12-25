import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { ScanResponse } from '../../../shared/types';

export interface LayoutContextType {
  lastBiosUpdate: string | null;
  refreshLibraryTrigger: number;
}

export default function Layout() {
  const [lastBiosUpdate, setLastBiosUpdate] = useState<string | null>(null);
  const [refreshLibraryTrigger, setRefreshLibraryTrigger] = useState(0);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Processing...");

  const onFilesDropped = async (files: FileList) => {
    setLoadingFile(true);
    setLoadingMessage("Importing & Extracting...");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = window.electron.getPathForFile(file);

      if (files.length > 1) setLoadingMessage(`Processing ${i + 1} of ${files.length}...`);
      
      try {
        const result: ScanResponse = await window.electron.invoke('process-file-drop', filePath);
        console.log('Drop Result:', result);
        
        if (result.success) {
          if (result.type === 'game') {
            setRefreshLibraryTrigger(prev => prev + 1);
          } 
          else if (result.type === 'bios') {
             setLastBiosUpdate(Date.now().toString());
          }
        } else {
          console.warn("File drop issue:", result.message);
        }
      } catch (err) {
        console.error("IPC Error:", err);
      } finally {
        setLoadingFile(false);
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
      {loadingFile && (
        <div className="absolute inset-0 z-110 flex flex-col items-center justify-center bg-bg-primary/80 backdrop-blur-md cursor-wait">
          <svg className="animate-spin h-12 w-12 text-accent-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          
          <h2 className="text-2xl font-bold text-fg-primary">{loadingMessage}</h2>
          <p className="text-sm text-fg-muted mt-2">Large files may take a while to unzip.</p>
        </div>
      )}

      {/* sidebar */}
      <aside className="w-64 flex flex-col border-r border-border-subtle bg-bg-secondary/30">
        <div className="p-6">
          <div className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-accent-primary to-accent-secondary">
            ROMBOX
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavLink 
            to="/" 
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all
              ${isActive ? 'bg-bg-muted text-fg-primary border border-border-highlight' : 'text-fg-muted hover:bg-bg-muted hover:text-fg-primary'}
            `}
          >
            Library
          </NavLink>

          <NavLink 
            to="/controls" 
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all
              ${isActive ? 'bg-bg-muted text-fg-primary border border-border-highlight' : 'text-fg-muted hover:bg-bg-muted hover:text-fg-primary'}
            `}
          >
            Controls
          </NavLink>
          
          <NavLink 
            to="/settings" 
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all
              ${isActive ? 'bg-bg-muted text-fg-primary border border-border-highlight' : 'text-fg-muted hover:bg-bg-muted hover:text-fg-primary'}
            `}
          >
            Settings
          </NavLink>
        </nav>

        <div className="p-6 text-xs text-fg-muted opacity-50 text-center">
          <a href="https://github.com/toschaef/RomBox" target="_blank" rel="noreferrer" className="underline hover:text-fg-primary">
            Codebase
          </a>  
        </div>
      </aside>

      <main className="flex-1 overflow-hidden relative">
        <Outlet context={{ lastBiosUpdate, refreshLibraryTrigger } as LayoutContextType} />
      </main>
    </div>
  );
}