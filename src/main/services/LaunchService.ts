import { EngineService } from './EngineService';
import { BiosService } from './BiosService'
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

    const bios = BiosService.getConsoleBiosStatus(game.consoleId);

    if (bios.needsBios && bios.biosState !== "ok") {
      BiosService.ensureBiosInstalledFromCache(game.consoleId);
      const bios2 = BiosService.getConsoleBiosStatus(game.consoleId);

      if (bios2.biosState === "missing") {
        return {
          success: false,
          code: "MISSING_BIOS",
          message: `Required BIOS missing for ${game.consoleId}: ${bios2.missingRequiredFiles.join(", ")}`,
        };
      }
    }

    if (bios.needsBios && bios.biosState === "missing") {
      const missing = bios.missingRequiredFiles.join(", ");
      return {
        success: false,
        code: "MISSING_BIOS",
        message: missing
          ? `Required BIOS missing for ${game.consoleId}: ${missing}`
          : `Required BIOS missing for ${game.consoleId}`,
      };
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
      const child = osHandler.launchProcess(binary, args);

      // child.stdout?.on('data', (d) => console.log(`[Emulator]: ${d}`));
      // child.stderr?.on('data', (d) => console.error(`[Emulator Err]: ${d}`));
      
      child.on('error', (err) => console.error("[LaunchService] Failed to spawn:", err));
      child.on('close', (code) => {
        if (code !== 0) console.log(`[LaunchService] Exited with code ${code}`);
      });

      child.unref();

      return { success: true };

    } catch (err) {
      console.error("[LaunchService] Launch Failed:", err);
      return { success: false, message: err.message };
    }
  }
};