import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import { initDB } from './data/db';
import registerGameHandlers from './ipc/gameHandlers';
import registerEngineHandlers from './ipc/engineHandlers';
import registerControlsHandlers from './ipc/controlsHandler';
import registerSettingsHandlers from './ipc/settingsHandler';
import registerBiosHandlers from './ipc/biosHandler';
import registerSaveHandlers from './ipc/saveHandler';
import { ScannerService } from './services/ScannerService';
import { LibraryService } from './services/LibraryService';
import { BiosService } from './services/BiosService';
import { EngineService } from './services/EngineService';
import { SettingsService } from './services/SettingsService';
import { Extractor } from './utils/extractor';
import { Logger } from './utils/logger';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const log = Logger.create('Main');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  log.info('Squirrel startup detected, quitting');
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

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data:; img-src 'self' 'unsafe-inline' data: cover: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; frame-src 'self' https://www.youtube.com https://youtube.com;"
        ]
      }
    });
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  // mainWindow.webContents.openDevTools();
};

function registerCoverProtocol() {
  protocol.handle('cover', (request) => {
    const rawPath = request.url.replace(/^cover:\/\/+/, '');
    const decodedPath = decodeURIComponent(rawPath);
    
    const filePath = path.resolve('/', decodedPath);
    
    const coversDir = path.join(app.getPath('userData'), 'covers');
    const normalizedPath = path.normalize(filePath);
    const isChild = normalizedPath.toLowerCase().startsWith(coversDir.toLowerCase());

    if (!isChild) {
      return new Response('Access denied', { status: 403 });
    }
    
    return net.fetch(pathToFileURL(normalizedPath).toString());
  });
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'cover', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } }
]);

app.on('ready', () => {
  registerCoverProtocol();
  
  initDB();

  registerGameHandlers();
  registerEngineHandlers();
  registerControlsHandlers();
  registerSettingsHandlers();
  registerBiosHandlers();
  registerSaveHandlers();

  createWindow();

  log.info('Initialized');
});

ipcMain.handle('process-file-drop', async (_, filePath) => {
  const dropLog = Logger.create('FileDrop', { path: filePath });
  dropLog.info('Processing file drop');
  
  try {
    const results = await ScannerService.scanPath(filePath);
    dropLog.info('Scan complete', { resultCount: results.length });
    
    const processedGames = [];
    let biosCount = 0;

    const settingsService = new SettingsService();
    const shouldAutoInstall = settingsService.get("setup.autoInstallEngines");
    
    for (const result of results) {
      if (result.type === 'game') {
        dropLog.info('Processing game', { consoleId: result.consoleId });
        const gameData = await ScannerService.importGame(result);
        const createResult = await LibraryService.createGame(gameData);
        processedGames.push(createResult.game);
        dropLog.info('Game imported successfully', { gameId: createResult.game.id, title: createResult.game.title });

        if (shouldAutoInstall) {
           dropLog.info('Auto-installing engine for game', { engineId: gameData.engineId });
           EngineService.installEngine(gameData.engineId, (status) => {
             dropLog.info(`Engine install status: ${status}`, { engineId: gameData.engineId });
           }).catch(err => {
             dropLog.error('Failed to auto-install engine', { engineId: gameData.engineId, error: err.message });
           });
        }
      }
      else if (result.type === "bios") {
        dropLog.info('Processing BIOS file', { consoleId: result.consoleId });
        const st = fs.statSync(result.filePath);

        if (!result.zipEntryName && st.isDirectory()) {
          dropLog.info('Installing BIOS from directory');
          await BiosService.installBios(result.consoleId, result.filePath);
          biosCount++;
          
          if (shouldAutoInstall) {
             const engineId = result.engineId;
             dropLog.info('Auto-installing engine for BIOS', { engineId });
             EngineService.installEngine(engineId, (status) => {
               dropLog.info(`Engine install status: ${status}`, { engineId });
             }).catch(err => {
                dropLog.error('Failed to auto-install engine', { engineId, error: err.message });
             });
          }
          continue;
        }

        const originalName = result.zipEntryName
          ? path.basename(result.zipEntryName)
          : path.basename(result.filePath);

        const tempDir = path.join(
          app.getPath("temp"),
          `rombox_drop_${result.consoleId}_${Date.now()}`
        );
        fs.mkdirSync(tempDir, { recursive: true });
        dropLog.debug('Created temp directory', { tempDir });

        const tempPath = path.join(tempDir, originalName);

        try {
          dropLog.info('Extracting BIOS file', { originalName });
          await Extractor.extractToFile(result.filePath, tempPath, result.zipEntryName);
          await BiosService.installBios(result.consoleId, tempPath);
          biosCount++;
          dropLog.info('BIOS installed successfully', { consoleId: result.consoleId });

          if (shouldAutoInstall) {
             const engineId = result.engineId;
             dropLog.info('Auto-installing engine for BIOS', { engineId });
             EngineService.installEngine(engineId, (status) => {
               dropLog.info(`Engine install status: ${status}`, { engineId });
             }).catch(err => {
                dropLog.error('Failed to auto-install engine', { engineId, error: err.message });
             });
          }
        } finally {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            dropLog.debug('Cleaned up temp directory');
          } catch (err) {
            dropLog.warn('Failed to clean up temp directory', err);
          }
        }
      }
    }

    dropLog.info('File drop processing complete', { 
      gamesProcessed: processedGames.length, 
      biosFilesProcessed: biosCount 
    });
    
    return {
      success: true,
      games: processedGames,
      biosCount,
      message: `Processed ${processedGames.length} games and ${biosCount} BIOS files.`
    };
  } catch (err) {
    dropLog.error('Drop failed', err);
    return { success: false, message: err.message };
  }
});