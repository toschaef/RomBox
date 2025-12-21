import { ipcMain } from 'electron';
import { EngineService } from '../services/EngineService';

export default function engineHandlers() {
  ipcMain.handle('install-engine', async (event, consoleId) => {
    const progressCallback = (status: string) => {
      event.sender.send('install-status-update', status);
    };
    return await EngineService.installEngine(consoleId, progressCallback);
  });

  ipcMain.handle('is-engine-installed', (event, consoleId) => {
    return EngineService.getEnginePath(consoleId) !== null;
  });

  ipcMain.handle('install-bios', async (_, { consoleId, filePath }) => {
    try {
      console.log(`[IPC] Installing BIOS for ${consoleId} from ${filePath}`);
      return EngineService.installBios(consoleId, filePath);
    } catch (err: any) {
      console.error("Failed to install BIOS:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('clear-engines', async () => {
    return EngineService.clearEngines();
  });
}