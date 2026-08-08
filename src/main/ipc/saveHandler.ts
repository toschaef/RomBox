import { ipcMain } from "electron";
import { SaveService } from "../services/SaveService";
import { LibraryService } from "../services/LibraryService";
import { Logger } from "../utils/logger";
import type { Game } from "../../shared/types";

const log = Logger.create("saveHandler");

type GameIdPayload = { gameId: string };

function withGame<TPayload extends GameIdPayload, TResult>(
  operation: string,
  handler: (game: Game, payload: TPayload) => TResult | Promise<TResult>
) {
  return async (_event: unknown, payload: TPayload) => {
    try {
      const gameId = payload?.gameId;
      if (typeof gameId !== "string" || gameId.length === 0) {
        return { success: false, message: "Invalid gameId" };
      }

      const result = LibraryService.getGame(gameId);
      if (!result.success || !result.game) {
        return { success: false, message: "Game not found" };
      }

      return await handler(result.game as Game, payload);
    } catch (err) {
      const message = (err as Error)?.message;
      log.error(`Failed to ${operation}`, err);
      return { success: false, message };
    }
  };
}

export default function registerSaveHandlers() {
  ipcMain.handle(
    "save:status",
    withGame("get save status", (game) => ({
      success: true,
      status: SaveService.getSaveStatus(game),
    }))
  );

  ipcMain.handle(
    "save:backup",
    withGame("backup save", (game) => {
      const result = SaveService.backupSave(game);
      return {
        success: result.success,
        gameId: game.id,
        backedUpFiles: result.backedUpFiles,
        message: result.error,
      };
    })
  );

  ipcMain.handle(
    "save:restore",
    withGame("restore save", (game) => {
      const result = SaveService.restoreSave(game);
      return {
        success: result.success,
        gameId: game.id,
        restoredFiles: result.restoredFiles,
        message: result.error,
      };
    })
  );

  ipcMain.handle(
    "save:delete",
    withGame("delete cached save", (game) => {
      const result = SaveService.deleteCachedSave(game);
      return {
        success: result.success,
        gameId: game.id,
        deletedFiles: result.deletedFiles,
        message: result.error,
      };
    })
  );

  ipcMain.handle(
    "save:export",
    withGame("export save", async (game) => {
      const result = await SaveService.exportSave(game);
      return {
        success: result.success,
        gameId: game.id,
        exportedTo: result.exportedTo,
        message: result.error,
      };
    })
  );

  ipcMain.handle(
    "save:import",
    withGame(
      "import save",
      async (game, payload: GameIdPayload & { sourcePath?: string }) => {
        const result = await SaveService.importSave(game, payload.sourcePath);
        return {
          success: result.success,
          gameId: game.id,
          importedFiles: result.importedFiles,
          replacedTo: result.replacedTo,
          issues: result.issues,
          message: result.error,
        };
      }
    )
  );

  ipcMain.handle("save:list", async () => {
    try {
      return { success: true, saves: SaveService.listAllSaves() };
    } catch (err) {
      log.error("Failed to list saves", err);
      return { success: false, message: (err as Error)?.message };
    }
  });
}
