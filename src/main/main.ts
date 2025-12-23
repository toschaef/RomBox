import { app, BrowserWindow, ipcMain } from 'electron';
import { initDB } from './data/db';
import registerGameHandlers from './ipc/gameHandlers';
import registerEngineHandlers from './ipc/engineHandlers';
import { ScannerService } from './services/ScannerService';
import { LibraryService } from './services/LibraryService';
import { EngineService } from './services/EngineService';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 1000,
    width: 1200,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.on('ready', () => {
  initDB();

  registerGameHandlers();
  registerEngineHandlers();
  
  createWindow();
});

ipcMain.handle('process-file-drop', async (_, filePath) => {
  try {
    // scan
    const result = await ScannerService.scanFile(filePath);

    if (result.type === 'game') {
      // import
      const gameData = await ScannerService.importGame(result);
      // save to db
      const game = await LibraryService.createGame(gameData);
      return { success: true, type: 'game', game };
    } 
    else if (result.type === 'bios') {
      // install bios
      await EngineService.installBios(result.consoleId, result.filePath);
      return { success: true, type: 'bios' };
    }
    return { success: false, message: "Unknown file" };
  } catch (err) {
    console.error("Drop failed:", err);
    return { success: false, message: err.message };
  }
});