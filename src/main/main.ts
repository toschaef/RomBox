import { app, BrowserWindow, ipcMain, protocol, net, dialog } from 'electron';
import { updateElectronApp } from 'update-electron-app';
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
import { getConsoleNameFromId } from '../shared/constants';

const log = Logger.create('Main');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  log.info('Squirrel startup detected, quitting');
  app.quit();
}

updateElectronApp();

const createWindow = (): void => {
  const isHidden = process.argv.includes('--hidden-test-window');
  const mainWindow = new BrowserWindow({
    height: 1000,
    width: 1200,
    show: !isHidden,
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
    const biosLabels: string[] = [];

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
           const existingPath = await EngineService.getEnginePath(gameData.engineId);
           if (!existingPath) {
             dropLog.info('Auto-installing engine for game', { engineId: gameData.engineId });
             EngineService.installEngine(gameData.engineId, (status) => {
               dropLog.info(`Engine install status: ${status}`, { engineId: gameData.engineId });
             }).catch(err => {
               dropLog.error('Failed to auto-install engine', { engineId: gameData.engineId, error: err.message });
             });
           } else {
             dropLog.debug('Engine already installed, skipping auto-install', { engineId: gameData.engineId });
           }
        }
      }
      else if (result.type === "bios") {
        dropLog.info('Processing BIOS file', { consoleId: result.consoleId });

        const consoleName = getConsoleNameFromId(result.consoleId);

        const biosFileName = result.zipEntryName
          ? path.basename(result.zipEntryName)
          : path.basename(result.filePath);
        biosLabels.push(`${consoleName} BIOS (${biosFileName})`);

        const st = fs.statSync(result.filePath);

        if (!result.zipEntryName && st.isDirectory()) {
          dropLog.info('Installing BIOS from directory');
          await BiosService.installBios(result.consoleId, result.filePath);
          
          if (shouldAutoInstall) {
             const engineId = result.engineId;
             const existingPath = await EngineService.getEnginePath(engineId);
             if (!existingPath) {
               dropLog.info('Auto-installing engine for BIOS', { engineId });
               EngineService.installEngine(engineId, (status) => {
                 dropLog.info(`Engine install status: ${status}`, { engineId });
               }).catch(err => {
                  dropLog.error('Failed to auto-install engine', { engineId, error: err.message });
               });
             } else {
               dropLog.debug('Engine already installed, skipping auto-install', { engineId });
             }
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
          dropLog.info('BIOS installed successfully', { consoleId: result.consoleId });

          if (shouldAutoInstall) {
             const engineId = result.engineId;
             const existingPath = await EngineService.getEnginePath(engineId);
             
             if (!existingPath) {
               dropLog.info('Auto-installing engine for BIOS', { engineId });
               EngineService.installEngine(engineId, (status) => {
                 dropLog.info(`Engine install status: ${status}`, { engineId });
               }).catch(err => {
                  dropLog.error('Failed to auto-install engine', { engineId, error: err.message });
               });
             } else {
               dropLog.debug('Engine already installed, skipping auto-install', { engineId });
             }
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

    const nothingRecognized = processedGames.length === 0 && biosLabels.length === 0;
    const fileExt = path.extname(filePath).toLowerCase() || undefined;

    dropLog.info('File drop processing complete', { 
      gamesProcessed: processedGames.length, 
      biosFilesProcessed: biosLabels.length 
    });
    
    return {
      success: !nothingRecognized,
      games: processedGames,
      biosCount: biosLabels.length,
      biosLabels,
      nothingRecognized,
      fileExtension: nothingRecognized ? fileExt : undefined,
      message: nothingRecognized
        ? `Unknown extension ${fileExt ?? '(none)'}`
        : `Processed ${processedGames.length} games and ${biosLabels.length} BIOS files.`
    };
  } catch (err) {
    const errorMessage = err instanceof Error
      ? err.message
      : (typeof err === 'string' ? err : String(err));
    dropLog.error('Drop failed', { error: err, message: errorMessage });

    return { success: false, message: errorMessage ?? "Unknown Error" };
  }
});

ipcMain.handle('select-files-or-directories', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return [];
  
  const result = await dialog.showOpenDialog(window, {
    properties: ['openFile', 'openDirectory', 'multiSelections'],
    title: 'Select Games or BIOS Files/Folders',
    buttonLabel: 'Import',
  });
  
  if (result.canceled) return [];
  return result.filePaths;
});