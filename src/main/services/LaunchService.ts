import { ENGINES } from '../config/engines';
import { getConfigurator } from '../emulators';
import { SaveService } from './SaveService';
import { settingsService } from './SettingsService';
import { LibraryService } from './LibraryService';
import { runPreflight } from './launch/LaunchPreflight';
import { startSession } from './launch/GameSession';
import { Logger } from '../utils/logger';
import type { Game } from '../../shared/types';

const log = Logger.create('LaunchService');

export type LaunchResponse = {
  success: boolean;
  code?: string;
  message?: string;
  /** set when the emulator started but its controls could not be written */
  configWarning?: string;
};

export const LaunchService = {
  launch: async (game: Game): Promise<LaunchResponse> => {
    const gameLog = log.child({ gameId: game.id, title: game.title });
    gameLog.info('Requesting launch');

    const preflight = await runPreflight(game);
    if (preflight.status === "blocked") {
      return { success: false, code: preflight.code, message: preflight.message };
    }

    restoreSaves(game, gameLog);
    const configWarning = await applyConfiguration(game, gameLog);

    const settings = settingsService;
    const engine = ENGINES[game.engineId];
    const command = engine.getLaunchCommand
      ? engine.getLaunchCommand(game, preflight.enginePath, {
          fullscreen: settings.get('launch.fullscreen'),
        })
      : [preflight.enginePath, game.filePath];

    try {
      startSession(game, command[0], command.slice(1));
    } catch (err) {
      gameLog.error('Launch failed', err);
      return { success: false, message: (err as Error)?.message };
    }

    // only counts as played once the process actually started.
    LibraryService.updateLastPlayed(game.id);

    return { success: true, configWarning };
  },
};

function restoreSaves(game: Game, gameLog: ReturnType<typeof log.child>) {
  gameLog.info('Restoring cached saves');
  try {
    const result = SaveService.restoreSave(game);
    if (result.restoredFiles.length > 0) {
      gameLog.info('Saves restored', {
        count: result.restoredFiles.length,
        files: result.restoredFiles,
      });
    } else {
      gameLog.debug('No cached saves to restore');
    }
  } catch (err) {
    gameLog.warn('Save restore failed', err);
  }
}

// writes the emulator's config
async function applyConfiguration(
  game: Game,
  gameLog: ReturnType<typeof log.child>
): Promise<string | undefined> {
  gameLog.info('Applying emulator configuration');

  const configurator = getConfigurator(game);
  if (!configurator) return undefined;

  try {
    await configurator.configure();
    gameLog.info('Configuration applied');
    return undefined;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    gameLog.warn('Configuration failed; launching with existing controls', err);
    return message;
  }
}
