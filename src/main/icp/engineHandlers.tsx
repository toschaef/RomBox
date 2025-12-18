import { ipcMain } from 'electron';
import { engineController } from '../controllers/engineController';

export default function engineHandlers() {
  ipcMain.handle('install-engine', async (event, consoleId) => {
    const progressCallback = (status: string) => {
      event.sender.send('install-status-update', status);
    };
    return await engineController.installEngine(consoleId, progressCallback);
  });

  ipcMain.handle('is-engine-installed', (event, consoleId) => {
    return engineController.isInstalled(consoleId);
  });

  ipcMain.handle('clear-engines', async () => {
    return engineController.clearEngines();
  });
}