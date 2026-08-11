import { BrowserWindow } from "electron";

import { LibraryService } from "../LibraryService";
import { SaveService } from "../SaveService";
import { osHandler } from "../../platform";
import { Logger } from "../../utils/logger";
import type { Game } from "../../../shared/types";

const log = Logger.create("GameSession");

export function startSession(game: Game, binary: string, args: string[]): void {
  const gameLog = log.child({ gameId: game.id, title: game.title });
  gameLog.info("Launching emulator", { binary, args });

  const startedAt = Date.now();
  const child = osHandler.launchProcess(binary, args);

  child.on("error", (err) => {
    gameLog.error("Failed to spawn emulator", err);
  });

  child.on("close", (code) => {
    if (code !== 0) gameLog.warn("Emulator exited with non-zero code", { code });

    recordPlaytime(game, startedAt, gameLog);
    backupSaves(game, gameLog);

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("game-exited", { gameId: game.id, code });
    }
  });

  child.unref();
}

function recordPlaytime(game: Game, startedAt: number, gameLog: ReturnType<typeof log.child>) {
  const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
  if (elapsedSeconds <= 0) return;

  LibraryService.addPlaytime(game.id, elapsedSeconds);
  gameLog.info("Playtime recorded", { elapsedSeconds });
}

function backupSaves(game: Game, gameLog: ReturnType<typeof log.child>) {
  try {
    const result = SaveService.backupSave(game);
    if (result.backedUpFiles.length > 0) {
      gameLog.info("Save files backed up", { count: result.backedUpFiles.length });
    }

    // only safe once the cache holds the copy the backup just made
    const cleaned = SaveService.cleanupEphemeralSaves(game);
    if (cleaned.removedFiles.length > 0) {
      gameLog.info("Injected saves removed", { count: cleaned.removedFiles.length });
    }
  } catch (err) {
    gameLog.error("Save backup failed", err);
  }
}
