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

      return gameData;

    } catch (err) {
      console.error("Database Insert Failed:", err);
      throw err;
    }
  },
  getGames: () => {
    try {
      const db = getDB();
      const stmt = db.prepare("select * from games");
      return stmt.all();
    } catch (err) {
      console.error("Database Select Failed:", err);
      throw err;
    }
  }
};