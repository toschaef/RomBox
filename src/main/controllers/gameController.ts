import fs from "fs";
import path from "path";
import { getDB } from "../db";
import type { Game } from "../../shared/types";
import { validationController } from "./validationController";
import { engineController } from "./engineController";
import { spawn } from "child_process";
import { app } from "electron";

export const gameController = {
  createGameFromData: (gameData: Game) => {
    try {
      const db = getDB();
      
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
  createGame: (file: { name: string; path: string }) => {
    try {
      const scanResult = validationController.scanFile(file.path);

      if (scanResult.type !== 'game') {
        throw new Error(`File is not a recognized game ROM: ${scanResult.type}`);
      }

      const gameData = validationController.importGame(scanResult);

      return gameController.createGameFromData(gameData);

    } catch (err: any) {
      console.error("Create Game Failed:", err);
      return { success: false, message: err.message };
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
  playGame: (game: Game) => {
    try {
      console.log(`Requesting launch for: ${game.title}`);
      const enginePath = engineController.getEnginePath(game.consoleId);

      if (!enginePath) {
        return { 
          success: false, 
          code: 'MISSING_ENGINE',
          message: `The emulator for ${game.consoleId.toUpperCase()} is not installed.`,
        };
      }

      if (!engineController.isBiosInstalled(game.consoleId)) {
        return {
          success: false,
          code: 'MISSING_BIOS',
          message: `BIOS missing for ${game.consoleId}`
        };
      }

      console.log(`Launching ${enginePath} with ${game.filePath}`);

      const child = spawn(enginePath, [game.filePath], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.stdout?.on('data', (data) => console.log(`[Emulator Log]: ${data}`));
      child.stderr?.on('data', (data) => console.error(`[Emulator Error]: ${data}`));

      child.on('error', (err) => {
        console.error("Failed to spawn process:", err);
      });

      child.on('close', (code) => {
        console.log(`Emulator process exited with code ${code}`);
      });

      child.unref();

      return { success: true };

    } catch (err) {
      console.error("Launch Failed:", err);
      return { success: false, message: "Failed to launch process." };
    }
  },

  clearLibrary: () => {
    const db = getDB();
    try {
      console.log("Clearing entire library...");

      db.prepare('DELETE FROM games').run();

      const romsDir = path.join(app.getPath('userData'), 'roms');
      if (fs.existsSync(romsDir)) {
        fs.rmSync(romsDir, { recursive: true, force: true });
        fs.mkdirSync(romsDir);
      }

      return { success: true };
    } catch (err) {
      console.error("Failed to clear library:", err);
      throw err;
    }
  },
};