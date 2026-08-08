import { app, BrowserWindow, protocol, net } from 'electron';
import { updateElectronApp } from 'update-electron-app';
import path from 'path';
import { pathToFileURL } from 'url';

import { closeDB, initDB } from './data/db';
import registerGameHandlers from './ipc/gameHandlers';
import registerEngineHandlers from './ipc/engineHandlers';
import registerControlsHandlers from './ipc/controlsHandler';
import registerSettingsHandlers from './ipc/settingsHandler';
import registerBiosHandlers from './ipc/biosHandler';
import registerSaveHandlers from './ipc/saveHandler';
import registerImportHandlers from './ipc/importHandler';
import { settingsService } from './services/SettingsService';
import { Logger } from './utils/logger';

const log = Logger.create('Main');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self' 'unsafe-inline' data:",
  "img-src 'self' 'unsafe-inline' data: cover: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "frame-src 'self' https://www.youtube.com https://youtube.com",
].join('; ') + ';';

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
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
      },
    });
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

function registerCoverProtocol() {
  protocol.handle('cover', (request) => {
    let rawPath = decodeURIComponent(request.url.replace(/^cover:\/\/+/, ''));

    if (process.platform === 'win32') {
      if (/^[a-zA-Z]\//.test(rawPath)) {
        rawPath = rawPath[0].toUpperCase() + ':' + rawPath.substring(1);
      } else if (/^\/[a-zA-Z]:/.test(rawPath)) {
        rawPath = rawPath.substring(1);
      }
    } else if (!rawPath.startsWith('/')) {
      rawPath = '/' + rawPath;
    }

    const filePath = path.normalize(rawPath);
    const coversDir = path.normalize(path.join(app.getPath('userData'), 'covers'));

    if (!filePath.toLowerCase().startsWith(coversDir.toLowerCase())) {
      return new Response('Access denied', { status: 403 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'cover', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } }
]);

app.on('ready', () => {
  registerCoverProtocol();

  initDB();

  settingsService.ensureDefaults();

  registerGameHandlers();
  registerEngineHandlers();
  registerControlsHandlers();
  registerSettingsHandlers();
  registerBiosHandlers();
  registerSaveHandlers();
  registerImportHandlers();

  createWindow();

  log.info('Initialized');
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  closeDB();
});
