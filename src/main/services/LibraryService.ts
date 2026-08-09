import fs from "fs";
import { gamesRepository } from "../data/repositories/GamesRepository";
import type { Game } from "../../shared/types";
import { ScannerService } from "./ScannerService";
import { SaveService } from "./SaveService";
import { isManagedPath, isMissing, romsRoot } from "./library/gamePaths";
import { Logger } from "../utils/logger";

const log = Logger.create('LibraryService');

// games live wherever the user keeps them, so a row can outlive its file.
// the renderer uses this to mark the card and offer to repoint it.
function withFileState(game: Game): Game {
  return { ...game, fileMissing: isMissing(game.filePath) };
}

export const LibraryService = {
  createGame: (gameData: Game) => {
    log.info('Creating game', { id: gameData.id, title: gameData.title, consoleId: gameData.consoleId });
    try {
      gamesRepository.insert(gameData);
      log.info('Game created successfully', { id: gameData.id });
      return { success: true, game: gameData };
    } catch (err) {
      log.error('Database insert failed', err);
      throw err;
    }
  },

  createGamesFromFiles: async (file: { name: string; path: string }) => {
    log.info('Creating games from files', { name: file.name, path: file.path });
    try {
      const results = await ScannerService.scanPath(file.path);
      log.info('Scan complete', { resultCount: results.length });

      if (results.length === 0) {
        throw new Error("No identifiable games found in this location.");
      }

      const createdGames = [];

      for (const result of results) {
        if (result.type === 'game') {
          const gameData = await ScannerService.importGame(result);
          const gameEntry = await LibraryService.createGame(gameData);
          createdGames.push(gameEntry.game);
        }
        else if (result.type === 'bios') {
          await ScannerService.importBios(result);
        }
      }

      if (createdGames.length === 0) {
        log.warn('No games found, only system files detected');
        return { success: false, message: "No games found (only system files detected)." };
      }

      log.info('Games created from files', { count: createdGames.length });
      return { success: true, games: createdGames };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('Create games from files failed', err);
      return { success: false, message: msg };
    }
  },

  getGames: () => {
    log.debug('Getting all games');
    try {
      const games = gamesRepository.findAll().map(withFileState);
      log.debug('Games retrieved', { count: games.length });
      return { success: true, games };
    } catch (err) { 
      const msg = err instanceof Error ? err.message : String(err);
      log.error('Failed to get games', err);
      return { success: false, message: msg }; 
    }
  },

  getGame: (id: string) => {
    try {
      const game = gamesRepository.findById(id);
      if (!game) return { success: false, message: "Game not found" };
      return { success: true, game: withFileState(game) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  },

  updateGame: (game: Game) => {
    try {
      return {
        success: gamesRepository.updateTitleAndConsole(game.id, game.title, game.consoleId),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  },

  relocateGame: async (gameId: string, newPath: string) => {
    log.info('Relocating game', { gameId, newPath });

    const game = gamesRepository.findById(gameId);
    if (!game) return { success: false, message: "Game not found" };

    if (!newPath || !fs.existsSync(newPath))
      return { success: false, message: `No file found at ${newPath}` };

    try {
      const results = await ScannerService.scanPath(newPath);
      const candidates = results.filter((r) => r.type === 'game');

      let filePath: string;

      if (candidates.length === 0) {
        if (!fs.statSync(newPath).isFile())
          return { success: false, message: `No game found in ${newPath}` };

        filePath = newPath;
      } else {
        const match = candidates.find((r) => r.consoleId === game.consoleId);
        if (!match) {
          return {
            success: false,
            code: "CONSOLE_MISMATCH",
            message: `That file looks like a ${candidates[0].consoleId.toUpperCase()} game, but ${game.title} is ${game.consoleId.toUpperCase()}`,
          };
        }

        filePath = (await ScannerService.importGame(match)).filePath;
      }

      const updated = gamesRepository.updateFilePath(gameId, filePath);
      if (!updated) return { success: false, message: "Game not found" };

      log.info('Game relocated', { gameId, filePath });
      return { success: true, game: withFileState({ ...game, filePath }) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('Relocate failed', err);
      return { success: false, message: msg };
    }
  },

  deleteGame: (gameId: string) => {
    log.info('Deleting game', { gameId });
    try {
      const game = gamesRepository.findById(gameId);
      if (!game) {
        log.warn('Game not found for deletion', { gameId });
        return { success: false, message: "Game not found" };
      }

      try {
        const backup = SaveService.backupSave(game);
        if (backup.backedUpFiles.length > 0) {
          log.info('Saves cached before deletion', { gameId, count: backup.backedUpFiles.length });
        }
      } catch (err) {
        log.warn('Save backup before deletion failed', err);
      }

      gamesRepository.delete(gameId);
      if (isManagedPath(game.filePath) && fs.existsSync(game.filePath)) {
        try {
          fs.unlinkSync(game.filePath);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'EISDIR') {
            fs.rmSync(game.filePath, { recursive: true, force: true });
          } else {
            throw err;
          }
        }
      }

      log.info('Game deleted successfully', { gameId, title: game.title });
      return { success: true };
    } catch (err) { 
      const msg = err instanceof Error ? err.message : String(err);
      log.error('Failed to delete game', err);
      return { success: false, message: msg }; 
    }
  },

  clearLibrary: () => {
    log.info('Clearing entire library');

    try {
      const games = (LibraryService.getGames().games ?? []) as Game[];
      for (const game of games) {
        try {
          SaveService.backupSave(game);
        } catch (err) {
          log.warn('Save backup before clearing library failed', { gameId: game.id, error: (err as Error)?.message });
        }
      }
    } catch (err) {
      log.warn('Could not enumerate games before clearing library', err);
    }

    gamesRepository.deleteAll();
    const romsDir = romsRoot();
    if (fs.existsSync(romsDir)) {
      fs.rmSync(romsDir, { recursive: true, force: true });
      fs.mkdirSync(romsDir);
    }
    log.info('Library cleared successfully');
    return { success: true };
  },

  addPlaytime: (gameId: string, seconds: number) => {
    log.debug('Adding playtime', { gameId, seconds });
    try {
      return { success: gamesRepository.addPlaytime(gameId, seconds) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('Failed to update playtime', err);
      return { success: false, message: msg };
    }
  },

  updateLastPlayed: (gameId: string) => {
    log.debug('Updating last played time', { gameId });
    try {
      return { success: gamesRepository.setLastPlayed(gameId) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('Failed to update last played time', err);
      return { success: false, message: msg };
    }
  },
};