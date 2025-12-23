import { ipcMain } from 'electron';
import { EngineService } from '../services/EngineService';

export default function registerEngineHandlers() {
  ipcMain.handle('install-engine', async (event, consoleId) => {
    const progressCallback = (status: string) => {
      event.sender.send('install-status-update', status);
    };
    return await EngineService.installEngine(consoleId, progressCallback);
  });

  ipcMain.handle('is-engine-installed', async (event, consoleId) => {
    const path = await EngineService.getEnginePath(consoleId);
    return path !== null;
  });

  ipcMain.handle('install-bios', async (_, { consoleId, filePath }) => {
    try {
      return await EngineService.installBios(consoleId, filePath);
    } catch (err) {
      console.error("Failed to install BIOS:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('clear-engines', async () => {
    return EngineService.clearEngines();
  });
}