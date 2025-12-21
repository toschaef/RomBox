import { EngineService } from './EngineService';
import { ENGINES } from '../config/engines';
import { osHandler } from '../platform';
import { getConfigurator } from '../utils/configurators';
import type { Game } from '../../shared/types';
import path from 'path';
import fs from 'fs';

export const LaunchService = {
  launch: async (game: Game) => {
    console.log(`[LaunchService] Requesting launch for: ${game.title}`);

    // validation
    const enginePath = await EngineService.getEnginePath(game.consoleId);
    if (!enginePath) {
      return { success: false, code: 'MISSING_ENGINE', message: `Emulator for ${game.consoleId} not installed.` };
    }

    if (!EngineService.isBiosInstalled(game.consoleId)) {
      return { success: false, code: 'MISSING_BIOS', message: `BIOS missing for ${game.consoleId}` };
    }

    // configuration
    const configurator = getConfigurator(game.consoleId);
    if (configurator) {
      try {
        await configurator.configure();
      } catch (err) {
        console.warn(`[LaunchService] Config warning:`, err.message);
      }
    }

    const engineConfig = ENGINES[game.consoleId];
    const fullCommand = engineConfig.getLaunchCommand 
      ? engineConfig.getLaunchCommand(game, enginePath)
      : [enginePath, game.filePath];

    const binary = fullCommand[0];
    const args = fullCommand.slice(1);

    // execution
    try {
      const child = osHandler.launchProcess(binary, args);
      engineConfig.postLaunch?.();

      child.stdout?.on('data', (d) => console.log(`[Emulator]: ${d}`));
      child.stderr?.on('data', (d) => console.error(`[Emulator Err]: ${d}`));
      
      child.on('error', (err) => console.error("[LaunchService] Failed to spawn:", err));
      child.on('close', (code) => {
        if (code !== 0) console.log(`[LaunchService] Exited with code ${code}`);
      });

      child.unref();

      return { success: true };

    } catch (err) {
      console.error("Launch Failed:", err);
      return { success: false, message: err.message };
    }
  }
};