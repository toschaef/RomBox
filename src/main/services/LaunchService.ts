import { BrowserWindow } from 'electron';
import { EngineService } from './EngineService';
import { BiosService } from './BiosService'
import { LibraryService } from './LibraryService';
import { SaveService } from './SaveService';
import { ENGINES } from '../config/engines';
import { osHandler } from '../platform';
import { getConfigurator } from '../utils/configurators';
import { Logger } from '../utils/logger';
import type { Game } from '../../shared/types';

const log = Logger.create('LaunchService');

export const LaunchService = {
  launch: async (game: Game) => {
    const gameLog = log.child({ gameId: game.id, title: game.title });
    gameLog.info('Requesting launch');

    // validation
    gameLog.info('Checking engine path', { engineId: game.engineId });
    const enginePath = await EngineService.getEnginePath(game.engineId);
    if (!enginePath) {
      gameLog.warn('Engine not installed', { consoleId: game.consoleId });
      return { success: false, code: 'MISSING_ENGINE', message: `Emulator for ${game.consoleId} not installed.` };
    }
    gameLog.info('Engine found', { enginePath });

    // bios
    gameLog.info('Checking BIOS status');
    const bios0 = BiosService.getGameBiosStatus(game);
    gameLog.debug('BIOS status', bios0);

    if (bios0.needsBios && bios0.biosState === "missing") {
      gameLog.info('BIOS missing, checking cache');
      BiosService.ensureBiosInstalledFromCache(game.consoleId);

      const bios1 = BiosService.getGameBiosStatus(game);
      gameLog.debug('BIOS status after cache check', bios1);

      if (bios1.biosState === "missing") {
        return {
          success: false,
          code: "MISSING_BIOS",
          message: bios1.missingRequiredFiles.join(", "),
        };
      }
    }

    if (bios0.needsBios && bios0.biosState === "warning") {
      // todo: optional bios message
    }

    // restore saves
    gameLog.info('Restoring cached saves');
    try {
      const restoreResult = SaveService.restoreSave(game);
      if (restoreResult.restoredFiles.length > 0) {
        gameLog.info('Saves restored', { count: restoreResult.restoredFiles.length, files: restoreResult.restoredFiles });
      } else {
        gameLog.debug('No cached saves to restore');
      }
    } catch (err) {
      gameLog.warn('Save restore failed', err);
    }

    // configuration
    gameLog.info('Applying emulator configuration');
    const configurator = getConfigurator(game);
    if (configurator) {
      try {
        await configurator.configure();
        gameLog.info('Configuration applied');
      } catch (err) {
        gameLog.warn('Configuration warning', err);
      }
    }

    const engineConfig = ENGINES[game.engineId];
    const fullCommand = engineConfig.getLaunchCommand
      ? engineConfig.getLaunchCommand(game, enginePath)
      : [enginePath, game.filePath];

    const binary = fullCommand[0];
    const args = fullCommand.slice(1);

    // execution
    gameLog.info('Launching emulator', { binary, args });
    try {
      const startTime = Date.now();
      const child = osHandler.launchProcess(binary, args);

      // child.stdout?.on('data', (d) => console.log(`[Emulator]: ${d}`));
      // child.stderr?.on('data', (d) => console.error(`[Emulator Err]: ${d}`));

      child.on('error', (err) => console.error("[LaunchService] Failed to spawn:", err));
      child.on('close', (code) => {
        if (code !== 0) gameLog.warn('Emulator exited with non-zero code', { code });

        // save playtime
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        if (elapsedSeconds > 0) {
          LibraryService.addPlaytime(game.id, elapsedSeconds);
          gameLog.info('Playtime recorded', { elapsedSeconds });
        }

        // backup saves
        try {
          const backupResult = SaveService.backupSave(game);
          if (backupResult.backedUpFiles.length > 0) {
            gameLog.info('Save files backed up', { count: backupResult.backedUpFiles.length });
          }
        } catch (err) {
          gameLog.error('Save backup failed', err);
        }

        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('game-exited', { gameId: game.id, code });
        }
      });

      child.unref();

      return { success: true };

    } catch (err) {
      gameLog.error('Launch failed', err);
      return { success: false, message: err.message };
    }
  }
};