import fs from "fs";
import path from "path";
import { getDB } from "../data/db";
import type { Game } from "../../shared/types";
import { ScannerService } from "./ScannerService";
import { Logger } from "../utils/logger";
import { app } from "electron";

const log = Logger.create('LibraryService');

export const LibraryService = {
  createGame: (gameData: Game) => {
    log.info('Creating game', { id: gameData.id, title: gameData.title, consoleId: gameData.consoleId });
    try {
      const db = getDB();
      const stmt = db.prepare(`
        insert into games (id, title, filePath, consoleId, engineId) 
        values (@id, @title, @filePath, @consoleId, @engineId)
      `);
      stmt.run(gameData);
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
    } catch (err: any) {
      log.error('Create games from files failed', err);
      return { success: false, message: err.message };
    }
  },

  getGames: () => {
    log.debug('Getting all games');
    try {
      const rows = getDB().prepare("select * from games").all() as any[];
      const games = rows.map(row => ({
        ...row,
        playtimeSeconds: row.playtime_seconds ?? 0,
        lastPlayedAt: row.last_played_at ?? null,
      }));
      log.debug('Games retrieved', { count: games.length });
      return { success: true, games };
    } catch (err: any) { 
      log.error('Failed to get games', err);
      return { success: false, message: err.message }; 
    }
  },

  getGame: (id: string) => {
    try {
      const row = getDB().prepare("select * from games where id = @id").get({ id }) as any;
      if (!row) return { success: false, message: "Game not found" };
      return {
        success: true,
        game: { 
          ...row, 
          playtimeSeconds: row.playtime_seconds ?? 0,
          lastPlayedAt: row.last_played_at ?? null,
        }
      };
    } catch (err) { return { success: false, message: err.message }; }
  },

  updateGame: (game: Game) => {
    try {
      const stmt = getDB().prepare(`
        update games set title = @title, consoleId = @consoleId where id = @id
      `);
      return { success: stmt.run({ id: game.id, title: game.title, consoleId: game.consoleId }).changes > 0 };
    } catch (err) { return { success: false, message: err.message }; }
  },

  deleteGame: (gameId: string) => {
    log.info('Deleting game', { gameId });
    try {
      const db = getDB();
      const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as Game | undefined;
      if (!game) {
        log.warn('Game not found for deletion', { gameId });
        return { success: false, message: "Game not found" };
      }

      db.prepare('delete from games where id = ?').run(gameId);
      if (game.filePath && fs.existsSync(game.filePath)) fs.unlinkSync(game.filePath);

      log.info('Game deleted successfully', { gameId, title: game.title });
      return { success: true };
    } catch (err: any) { 
      log.error('Failed to delete game', err);
      return { success: false, message: err.message }; 
    }
  },

  clearLibrary: () => {
    log.info('Clearing entire library');
    getDB().prepare('DELETE FROM games').run();
    const romsDir = path.join(app.getPath('userData'), 'roms');
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
      const db = getDB();
      const stmt = db.prepare(`
        UPDATE games SET playtime_seconds = playtime_seconds + ? WHERE id = ?
      `);
      const result = stmt.run(Math.floor(seconds), gameId);
      return { success: result.changes > 0 };
    } catch (err: any) {
      log.error('Failed to update playtime', err);
      return { success: false, message: err.message };
    }
  },

  updateLastPlayed: (gameId: string) => {
    log.debug('Updating last played time', { gameId });
    try {
      const db = getDB();
      const stmt = db.prepare(`
        UPDATE games SET last_played_at = ? WHERE id = ?
      `);
      const result = stmt.run(Date.now(), gameId);
      return { success: result.changes > 0 };
    } catch (err: any) {
      log.error('Failed to update last played time', err);
      return { success: false, message: err.message };
    }
  },
};