import fs from "fs";
import path from "path";
import { getDB } from "../data/db";
import type { Game } from "../../shared/types";
import { ScannerService } from "./ScannerService";
import { app } from "electron";

export const LibraryService = {
  createGame: (gameData: Game) => {
    try {
      const db = getDB();
      const stmt = db.prepare(`
        insert into games (id, title, filePath, consoleId, engineId) 
        values (@id, @title, @filePath, @consoleId, @engineId)
      `);
      stmt.run(gameData);
      return { success: true, game: gameData };
    } catch (err) {
      console.error("Database Insert Failed:", err);
      throw err;
    }
  },
  
  createGamesFromFiles: async (file: { name: string; path: string }) => {
    try {
      const results = await ScannerService.scanPath(file.path);

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
        return { success: false, message: "No games found (only system files detected)." };
      }

      return { success: true, games: createdGames };
    } catch (err) {
      console.error("Create Game Failed:", err);
      return { success: false, message: err.message };
    }
  },

  getGames: () => {
    try {
      return { success: true, games: getDB().prepare("select * from games").all() };
    } catch (err) { return { success: false, message: err.message }; }
  },

  getGame: (id: string) => {
    try {
      return { success: true, game: getDB().prepare("select * from games where id = @id").get({ id }) };
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
    try {
      const db = getDB();
      const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as Game | undefined;
      if (!game) return { success: false, message: "Game not found" };

      db.prepare('delete from games where id = ?').run(gameId);
      if (game.filePath && fs.existsSync(game.filePath)) fs.unlinkSync(game.filePath);

      return { success: true };
    } catch (err) { return { success: false, message: err.message }; }
  },

  clearLibrary: () => {
    getDB().prepare('DELETE FROM games').run();
    const romsDir = path.join(app.getPath('userData'), 'roms');
    if (fs.existsSync(romsDir)) {
      fs.rmSync(romsDir, { recursive: true, force: true });
      fs.mkdirSync(romsDir);
    }
    return { success: true };
  },
};