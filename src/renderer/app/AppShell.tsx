import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useNotifications } from './notifications/NotificationProvider';
import { engineClient } from '../clients/engineClient';
import { libraryClient } from '../clients/libraryClient';
import { NOTIFICATION_MESSAGES } from '../../shared/constants';
import SideBar from './SideBar';
import FileDropZone from './FileDropZone';
import type { LayoutContextType } from './layoutContext';

export default function AppShell() {
  const [lastBiosUpdate, setLastBiosUpdate] = useState<string | null>(null);
  const [refreshLibraryTrigger, setRefreshLibraryTrigger] = useState(0);

  const { notify, setLoadingMessage, durations } = useNotifications();

  const activeInstalls = useRef(0);

  useEffect(() => {
    const removeListener = engineClient.onInstallStatusUpdate((status: string) => {
      if (status === 'complete') {
        activeInstalls.current = Math.max(0, activeInstalls.current - 1);
        if (activeInstalls.current === 0) {
          setLoadingMessage(null);
        }
      } else {
        if (activeInstalls.current === 0) {
          activeInstalls.current = 1;
          setLoadingMessage(status);
        } else if (status === 'Installing emulator\u2026') {
          activeInstalls.current += 1;
          setLoadingMessage(status);
        } else {
          setLoadingMessage(status);
        }
      }
    });

    return () => { if (removeListener) removeListener(); };
  }, [setLoadingMessage]);

  const setGlobalLoadingState = (l: boolean) => setLoadingMessage(l ? "Processing" : null);
  const setGlobalStatus = (s: string) => setLoadingMessage(s);

  const importFilePaths = async (filePaths: string[]) => {
    setLoadingMessage("Importing\u2026");

    let anyGames = false;
    let anyBios = false;

    const allGameTitles: string[] = [];
    const BiosLabels: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        if (filePaths.length > 1) setLoadingMessage(`Importing ${i + 1} of ${filePaths.length}\u2026`);
        
        try {
          const result = await libraryClient.processFileDrop(filePath);
          
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

    if (activeInstalls.current === 0) {
      setLoadingMessage(null);
    }

    const totalItems = allGameTitles.length + BiosLabels.length + errors.length;

    if (totalItems <= 3) {
      for (const title of allGameTitles) {
        notify(NOTIFICATION_MESSAGES.GAME_INSTALLED(title), { type: 'success', duration: durations.short });
      }
      for (const label of BiosLabels) {
        notify(NOTIFICATION_MESSAGES.BIOS_INSTALLED(label), { type: 'success', duration: durations.short });
      }
      for (const err of errors) {
        notify(NOTIFICATION_MESSAGES.ERROR_MESSAGE(err), { type: 'error', duration: durations.long });
      }
    } else {
      const successCount = allGameTitles.length + BiosLabels.length;
      if (successCount > 0) {
        const parts: string[] = [];
        if (allGameTitles.length > 0) parts.push(`${allGameTitles.length} game${allGameTitles.length > 1 ? 's' : ''}`);
        if (BiosLabels.length > 0) parts.push(`${BiosLabels.length} BIOS file${BiosLabels.length > 1 ? 's' : ''}`);
        notify(NOTIFICATION_MESSAGES.GAMES_AND_BIOS_INSTALLED(parts.join(' and ')), { type: 'success', duration: durations.medium });
      }
      if (errors.length > 0) {
        notify(NOTIFICATION_MESSAGES.FILES_FAILED(errors.length), { type: 'error', duration: durations.long });
      }
    }
  };

  const onFilesDropped = async (files: FileList) => {
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const filePath = libraryClient.getPathForFile(files[i]);
      if (filePath) paths.push(filePath);
    }
    await importFilePaths(paths);
  };

  return (
    <FileDropZone
      onFilesDropped={onFilesDropped}
      className="flex h-screen w-full bg-bg-primary text-fg-primary font-sans relative"
    >
      <SideBar />

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
    </FileDropZone>
  );
}