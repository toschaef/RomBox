import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import { schema } from "./schema";

let db: Database.Database | null = null;

export function initDB() {
  const dbPath = path.join(app.getPath("userData"), "rombox.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(schema);

  // v0.9.3 migrations
  const columns = db.prepare("PRAGMA table_info(games)").all() as { name: string }[];
  const hasLastPlayedAt = columns.some(c => c.name === 'last_played_at');
  if (!hasLastPlayedAt) {
    db.exec("ALTER TABLE games ADD COLUMN last_played_at INTEGER");
  }

  console.log("Database initialized");
}

export function getDB() {
  if (!db) throw new Error('Uninitialized DB');
  return db;
}