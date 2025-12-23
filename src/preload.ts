import { contextBridge, ipcRenderer, webUtils, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => 
    ipcRenderer.invoke(channel, ...args),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  on: (channel: string, func: (...args: unknown[]) => void): (() => void) => {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
});