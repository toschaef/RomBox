import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { ScanResponse } from '../../../shared/types';
import { settingsClient } from '../../clients/settingsClient';

export interface LayoutContextType {
  lastBiosUpdate: string | null;
  refreshLibraryTrigger: number;
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
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Processing...");
  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    // Refresh video ID from settings whenever layout mounts/remounts or could poll, 
    // but for now mount is fine or when drop happens.
    // Actually, let's fetch it when a drop starts to be sure we have the latest.
  }, []);

  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const onFilesDropped = async (files: FileList) => {
    setVideoId(getYoutubeId('https://youtu.be/J9dvPQuHz-I?si=Bk27fudKq90eZtee'));
    
    setLoadingFile(true);
    setLoadingMessage("Installing...");

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
        <div className="absolute inset-0 z-110 flex flex-col items-center justify-center bg-bg-primary/80 backdrop-blur-md cursor-wait overflow-hidden">
          {videoId ? (
             <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${videoId}`} 
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                ></iframe>
             </div>
          ) : (
            <svg className="animate-spin h-12 w-12 text-accent-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          
          <div className="z-10 flex flex-col items-center">
             {!videoId && <div className="h-4"></div> /* Spacer if no video, spinner handles margin */}
             <h2 className="text-3xl font-black text-transparent bg-clip-text bg-linear-to-r from-accent-primary to-accent-secondary animate-pulse drop-shadow-md">{loadingMessage}</h2>
             <p className="text-sm text-fg-primary mt-2 font-bold drop-shadow-md">Large files may take a while to unzip.</p>
          </div>
        </div>
      )}

      {/* sidebar */}
      <aside className="w-64 flex flex-col border-r border-border-subtle bg-bg-secondary/30">
        <div className="p-6">
          <div className="text-xl font-black font-stretch-expanded tracking-wide text-transparent bg-clip-text bg-linear-to-r from-accent-primary to-accent-secondary">
            RomBox
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {PAGES.map((p) =>
            <NavLink 
              to={`/${p.toLowerCase()}`}
              key={p}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all
                ${isActive ? 'bg-bg-muted text-fg-primary border border-border-highlight' : 'text-fg-muted hover:bg-bg-muted hover:text-fg-primary'}
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
        <Outlet context={{ lastBiosUpdate, refreshLibraryTrigger } as LayoutContextType} />
      </main>
    </div>
  );
}