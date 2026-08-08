import path from "path";

import type { Game, ConsoleID } from "../../shared/types";
import { osHandler } from "../platform";
import { Logger } from "../utils/logger";
import { resolveSaveRoots } from "../emulators";
import type { SaveRoot } from "../emulators/saveRoots";

const log = Logger.create("saveLayouts");

// resolves a game's save roots

export type {
  ImportNameContext,
  ImportNameResult,
  SaveRoot,
  SaveScope,
} from "../emulators/saveRoots";

function safeBasePath(engineId: Game["engineId"]): string | null {
  try {
    return osHandler.getEmulatorBasePath(engineId);
  } catch (err) {
    log.debug("Emulator base path unavailable", { engineId, error: (err as Error)?.message });
    return null;
  }
}

function safeSavePath(game: Game): string | null {
  try {
    return osHandler.getSavePath(game);
  } catch (err) {
    log.debug("Emulator save path unavailable", { engineId: game.engineId, error: (err as Error)?.message });
    return null;
  }
}

export function getConsoleCacheDir(cacheRoot: string, consoleId: ConsoleID | string): string {
  return path.join(cacheRoot, consoleId);
}

export function getSaveRoots(game: Game, cacheRoot: string): SaveRoot[] {
  return resolveSaveRoots({
    game,
    cacheRoot,
    consoleCache: getConsoleCacheDir(cacheRoot, game.consoleId),
    primary: safeSavePath(game),
    base: safeBasePath(game.engineId),
  });
}
