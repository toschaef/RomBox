import { BrowserWindow } from 'electron';
import { EngineService } from './EngineService';
import { BiosService } from './BiosService'
import { LibraryService } from './LibraryService';
import { ENGINES } from '../config/engines';
import { osHandler } from '../platform';
import { getConfigurator } from '../utils/configurators';
import type { Game } from '../../shared/types';

export const LaunchService = {
  launch: async (game: Game) => {
    console.log(`[LaunchService] Requesting launch for: ${game.title}`);

    // validation
    const enginePath = await EngineService.getEnginePath(game.engineId);
    if (!enginePath) {
      return { success: false, code: 'MISSING_ENGINE', message: `Emulator for ${game.consoleId} not installed.` };
    }

    // bios
    const bios0 = BiosService.getGameBiosStatus(game);
    console.log("[LaunchService] bios", bios0);

    if (bios0.needsBios && bios0.biosState === "missing") {
      BiosService.ensureBiosInstalledFromCache(game.consoleId);

      const bios1 = BiosService.getGameBiosStatus(game);
      console.log("[LaunchService] bios after cache", bios1);

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

    // configuration
    const configurator = getConfigurator(game);
    if (configurator) {
      try {
        await configurator.configure();
      } catch (err: any) {
        console.warn(`[LaunchService] Config warning:`, err?.message ?? err);
        if (err?.stack) console.warn(err.stack);
      }
    }

    const engineConfig = ENGINES[game.engineId];
    const fullCommand = engineConfig.getLaunchCommand
      ? engineConfig.getLaunchCommand(game, enginePath)
      : [enginePath, game.filePath];

    const binary = fullCommand[0];
    const args = fullCommand.slice(1);

    // execution
    try {
      const startTime = Date.now();
      const child = osHandler.launchProcess(binary, args);

      // child.stdout?.on('data', (d) => console.log(`[Emulator]: ${d}`));
      // child.stderr?.on('data', (d) => console.error(`[Emulator Err]: ${d}`));

      child.on('error', (err) => console.error("[LaunchService] Failed to spawn:", err));
      child.on('close', (code) => {
        if (code !== 0) console.log(`[LaunchService] Exited with code ${code}`);

        // save playtime
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        if (elapsedSeconds > 0) {
          LibraryService.addPlaytime(game.id, elapsedSeconds);
          console.log(`[LaunchService] Added ${elapsedSeconds}s playtime for ${game.title}`);
        }

        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('game-exited', { gameId: game.id, code });
        }
      });

      child.unref();

      return { success: true };

    } catch (err) {
      console.error("[LaunchService] Launch Failed:", err);
      return { success: false, message: err.message };
    }
  }
};