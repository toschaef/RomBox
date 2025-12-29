import { app, BrowserWindow, ipcMain } from 'electron';
import { initDB } from './data/db';
import registerGameHandlers from './ipc/gameHandlers';
import registerEngineHandlers from './ipc/engineHandlers';
import registerControlsHandlers from './ipc/controlsHandler';
import registerSettingsHandlers from './ipc/settingsHandler';
import { ScannerService } from './services/ScannerService';
import { LibraryService } from './services/LibraryService';
import { EngineService } from './services/EngineService';
import { Extractor } from './utils/extractor';
import path from 'path';
import fs from 'fs';

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
  registerControlsHandlers();
  registerSettingsHandlers();
  
  createWindow();
});

ipcMain.handle('process-file-drop', async (_, filePath) => {
  try {
    const results = await ScannerService.scanPath(filePath);
    const processedGames = [];
    let biosCount = 0;

    for (const result of results) {
      if (result.type === 'game') {
        const gameData = await ScannerService.importGame(result);
        const game = await LibraryService.createGame(gameData);
        processedGames.push(game);
      } 
      else if (result.type === 'bios') {
        const originalName = result.zipEntryName 
          ? path.basename(result.zipEntryName) 
          : path.basename(result.filePath);

        const tempPath = path.join(app.getPath('temp'), originalName);
        
        try {
          await Extractor.extractToFile(result.filePath, tempPath, result.zipEntryName);
          
          await EngineService.installBios(result.consoleId, tempPath);
          biosCount++;
        } finally {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
      }
    }

    return { 
      success: true, 
      games: processedGames, 
      biosCount,
      message: `Processed ${processedGames.length} games and ${biosCount} BIOS files.` 
    };
  } catch (err) {
    console.error("Drop failed:", err);
    return { success: false, message: err.message };
  }
});