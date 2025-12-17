import fs from "fs";
import { getDB } from "../db";
import type { Game } from "../../shared/types";
import { scrapeGameData } from "./validationController";

export const gameController = {
  createGame: (file: { name: string; path: string }) => {
    try {
      const db = getDB();
      const gameData: Game = scrapeGameData(file);
      
      console.log("Inserting game into database:", gameData);

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
  getGames: () => {
    try {
      const db = getDB();
      const stmt = db.prepare("select * from games");
      return { success: true, games: stmt.all() };
    } catch (err) {
      console.error("Database Select Failed:", err);
      throw err;
    }
  },
  getGame: (id: string) => {
    try {
      const db = getDB();
      const stmt = db.prepare("select * from games where id = @id");
      return { success: true, game: stmt.get({ id }) };
    } catch (err) {
      console.error("Database Select Failed:", err);
      throw err;
    }
  },
  updateGame: (game: Game) => {
    try {
      const db = getDB();

      const stmt = db.prepare(`
        update games 
        set title = @title, consoleId = @consoleId 
        where id = @id
      `);
      const info = stmt.run({
        id: game.id,
        title: game.title,
        consoleId: game.consoleId
      });

      return { success: info.changes > 0 };

    } catch (err) {
      console.error("Update Failed:", err);
      throw err;
    }
  },
  deleteGame: (gameId: string) => {
    try {
      const db = getDB();
      const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as Game | undefined;
      
      if (!game) {
        return { success: false, message: "Game not found" };
      }

      console.log(`Deleting game from DB: ${game.title}`);

      // delete from db
      db.prepare('delete from games where id = ?').run(gameId);

      // delete file
      if (game.filePath && fs.existsSync(game.filePath)) {
        console.log(`Removing file at: ${game.filePath}`);
        fs.unlinkSync(game.filePath);
      }

      return { success: true };

    } catch (err) {
      console.error("Delete Failed:", err);
      throw err;
    }
  },
};