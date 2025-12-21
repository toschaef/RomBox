import fs from "fs";
import path from "path";
import { getDB } from "../data/db";
import type { Game } from "../../shared/types";
import { EngineService } from "./EngineService";
import { ScannerService } from "./ScannerService";
import { spawn } from "child_process";
import { app } from "electron";

export const LibraryService = {
  createGame: (gameData: Game) => {
    try {
      const db = getDB();
      const stmt = db.prepare(`
        insert into games (id, title, filePath, consoleId) 
        values (@id, @title, @filePath, @consoleId)
      `);
      stmt.run(gameData);
      return { success: true, game: gameData };
    } catch (err) {
      console.error("Database Insert Failed:", err);
      throw err;
    }
  },
  
  createGameFromFile: async (file: { name: string; path: string }) => {
    try {
      const scanResult = await ScannerService.scanFile(file.path);
      if (scanResult.type !== 'game') throw new Error(`Not a game ROM: ${scanResult.type}`);
      const gameData = await ScannerService.importGame(scanResult);
      const game = await LibraryService.createGame(gameData);
      return { success: true, game: game.game };
    } catch (err: any) {
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
    try {
      getDB().prepare('DELETE FROM games').run();
      const romsDir = path.join(app.getPath('userData'), 'roms');
      if (fs.existsSync(romsDir)) {
        fs.rmSync(romsDir, { recursive: true, force: true });
        fs.mkdirSync(romsDir);
      }
      return { success: true };
    } catch (err) { throw err; }
  },
};