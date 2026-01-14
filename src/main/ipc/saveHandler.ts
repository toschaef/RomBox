import { ipcMain } from "electron";
import { SaveService } from "../services/SaveService";
import { LibraryService } from "../services/LibraryService";
import type { Game } from "../../shared/types";

function isValidGameId(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

export default function registerSaveHandlers() {
  ipcMain.handle("save:status", async (_evt, payload: { gameId: string }) => {
    try {
      const { gameId } = payload ?? ({} as { gameId: string });
      if (!isValidGameId(gameId)) {
        return { success: false, message: "Invalid gameId" };
      }

      const result = LibraryService.getGame(gameId);
      if (!result.success || !result.game) {
        return { success: false, message: "Game not found" };
      }

      const status = SaveService.getSaveStatus(result.game as Game);
      return { success: true, status };
    } catch (err) {
      console.error("Failed to get save status:", (err as Error).message);
      return { success: false, message: (err as Error).message };
    }
  });

  ipcMain.handle("save:backup", async (_evt, payload: { gameId: string }) => {
    try {
      const { gameId } = payload ?? ({} as { gameId: string });
      if (!isValidGameId(gameId)) {
        return { success: false, message: "Invalid gameId" };
      }

      const result = LibraryService.getGame(gameId);
      if (!result.success || !result.game) {
        return { success: false, message: "Game not found" };
      }

      const game = result.game as Game;
      const backupResult = SaveService.backupSave(game);
      return {
        success: backupResult.success,
        gameId,
        backedUpFiles: backupResult.backedUpFiles,
        message: backupResult.error
      };
    } catch (err) {
      console.error("Failed to backup save:", (err as Error).message);
      return { success: false, message: (err as Error).message };
    }
  });

  ipcMain.handle("save:restore", async (_evt, payload: { gameId: string }) => {
    try {
      const { gameId } = payload ?? ({} as { gameId: string });
      if (!isValidGameId(gameId)) {
        return { success: false, message: "Invalid gameId" };
      }

      const result = LibraryService.getGame(gameId);
      if (!result.success || !result.game) {
        return { success: false, message: "Game not found" };
      }

      const game = result.game as Game;
      const restoreResult = SaveService.restoreSave(game);
      return {
        success: restoreResult.success,
        gameId,
        restoredFiles: restoreResult.restoredFiles,
        message: restoreResult.error,
      };
    } catch (err) {
      console.error("Failed to restore save:", (err as Error).message);
      return { success: false, message: (err as Error).message };
    }
  });

  ipcMain.handle("save:delete", async (_evt, payload: { gameId: string }) => {
    try {
      const { gameId } = payload ?? ({} as { gameId: string });
      if (!isValidGameId(gameId)) {
        return { success: false, message: "Invalid gameId" };
      }

      const result = LibraryService.getGame(gameId);
      if (!result.success || !result.game) {
        return { success: false, message: "Game not found" };
      }

      const game = result.game as Game;
      const deleteResult = SaveService.deleteCachedSave(game);
      return {
        success: deleteResult.success,
        gameId,
        deletedFiles: deleteResult.deletedFiles,
        message: deleteResult.error,
      };
    } catch (err) {
      console.error("Failed to delete cached save:", (err as Error).message);
      return { success: false, message: (err as Error).message };
    }
  });

  ipcMain.handle("save:list", async () => {
    try {
      const saves = SaveService.listAllSaves();
      return { success: true, saves };
    } catch (err) {
      console.error("Failed to list saves:", (err as Error).message);
      return { success: false, message: (err as Error).message };
    }
  });

  ipcMain.handle("save:export", async (_evt, payload: { gameId: string }) => {
    try {
      const { gameId } = payload ?? ({} as { gameId: string });
      if (!isValidGameId(gameId)) {
        return { success: false, message: "Invalid gameId" };
      }

      const result = LibraryService.getGame(gameId);
      if (!result.success || !result.game) {
        return { success: false, message: "Game not found" };
      }

      const game = result.game as Game;
      const exportResult = await SaveService.exportSave(game);
      return {
        success: exportResult.success,
        gameId,
        exportedTo: exportResult.exportedTo,
        message: exportResult.error,
      };
    } catch (err) {
      console.error("Failed to export save:", (err as Error).message);
      return { success: false, message: (err as Error).message };
    }
  });
}

