import { ipcMain } from 'electron';
import { EngineService } from '../services/EngineService';

export default function registerEngineHandlers() {
  ipcMain.handle('engine:get-engines', async (event, consoleId) => {
    try {
      return await EngineService.getEngines();
    } catch (err) {
      console.error("Failed to get engines:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('engine:install-engine', async (event, consoleId) => {
    const progressCallback = (status: string) => {
      event.sender.send('install-status-update', status);
    };
    return await EngineService.installEngine(consoleId, progressCallback);
  });

  ipcMain.handle('engine:delete-engine', async (event, consoleId) => {
    return await EngineService.deleteEngine(consoleId);
  });

  ipcMain.handle('engine:is-installed', async (event, consoleId) => {
    const path = await EngineService.getEnginePath(consoleId);
    return path !== null;
  });

  ipcMain.handle('engine:install-bios', async (_, { consoleId, filePath }) => {
    try {
      return await EngineService.installBios(consoleId, filePath);
    } catch (err) {
      console.error("Failed to install BIOS:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('engine:clear', async () => {
    return EngineService.clearEngines();
  });
}