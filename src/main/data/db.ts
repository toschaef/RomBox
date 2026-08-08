import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import { schema } from "./schema";
import { runMigrations } from "./migrations";

let db: Database.Database | null = null;

export function closeDB() {
  if (db) {
    try {
      db.close();
    } catch {
      // Ignore
    }
    db = null;
  }
}

export function initDB() {
  closeDB();
  const dbPath = path.join(app.getPath("userData"), "rombox.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(schema);
  runMigrations(db);

  console.log("Database initialized");
}

export function getDB() {
  if (!db) throw new Error('Uninitialized DB');
  return db;
}