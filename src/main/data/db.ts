import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function initDB() {
  const dbPath = path.join(app.getPath('userData'), 'rombox.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const schema = `
    create table if not exists games (
      id text primary key not null,
      title text not null,
      filePath text not null,
      consoleId text not null,
      coverImage text
    );
  `;
  
  db.exec(schema);
  console.log("Database initialized");
}

export function getDB() {
  return db;
}