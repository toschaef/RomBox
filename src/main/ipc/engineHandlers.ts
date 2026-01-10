import { ipcMain } from 'electron';
import { EngineService } from '../services/EngineService';

export default function registerEngineHandlers() {
  ipcMain.handle('engine:get', async (event, consoleId) => {
    try {
      return await EngineService.getEngines();
    } catch (err) {
      console.error("Failed to get engines:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('engine:install-engine', async (event, engineId) => {
    const progressCallback = (status: string) => {
      event.sender.send('install-status-update', status);
    };
    return await EngineService.installEngine(engineId, progressCallback);
  });

  ipcMain.handle('engine:delete-engine', async (event, consoleId) => {
    return await EngineService.deleteEngine(consoleId);
  });

  ipcMain.handle('engine:is-installed', async (event, emulatorId) => {
    const path = await EngineService.getEnginePath(emulatorId);
    return path !== null;
  });

  ipcMain.handle('engine:clear', async () => {
    return EngineService.clearEngines();
  });
}