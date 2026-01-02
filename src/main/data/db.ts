import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

let db: Database.Database | null = null;

export function initDB() {
  const dbPath = path.join(app.getPath("userData"), "rombox.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const schema = `
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      filePath TEXT NOT NULL,
      consoleId TEXT NOT NULL,
      coverImage TEXT
    );

    CREATE TABLE IF NOT EXISTS controller_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      profile_json TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_controller_profiles_default
      ON controller_profiles(is_default)
      WHERE is_default = 1;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `;

  db.exec(schema);
  console.log("Database initialized");
}

export function getDB() {
  if (!db) throw new Error('Uninitialized DB');
  return db;
}