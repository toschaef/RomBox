import type Database from "better-sqlite3";
import { Logger } from "../../utils/logger";

const log = Logger.create("migrations");

export interface Migration {
  /** applied in ascending order; never renumber a released migration */
  version: number;
  name: string;
  up(db: Database.Database): void;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.some((c) => c.name === column);
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  type: string
): void {
  if (hasColumn(db, table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "games.last_played_at",
    up: (db) => addColumnIfMissing(db, "games", "last_played_at", "INTEGER"),
  },
  {
    version: 2,
    name: "console_layouts.controller_id",
    up: (db) => addColumnIfMissing(db, "console_layouts", "controller_id", "TEXT"),
  },
  {
    version: 3,
    name: "console_layouts per-player controller ids",
    up: (db) => {
      for (const player of [2, 3, 4]) {
        addColumnIfMissing(db, "console_layouts", `player${player}_controller_id`, "TEXT");
      }
    },
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0
);

function getVersion(db: Database.Database): number {
  const result = db.pragma("user_version") as
    | { user_version: number }[]
    | number
    | undefined;

  if (typeof result === "number") return result;
  if (Array.isArray(result)) return result[0]?.user_version ?? 0;
  return 0;
}

export function runMigrations(db: Database.Database): void {
  const from = getVersion(db);
  if (from >= LATEST_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;

    log.info("Applying migration", { version: migration.version, name: migration.name });

    migration.up(db);
    db.pragma(`user_version = ${migration.version}`);
  }

  log.info("Database schema up to date", { from, to: LATEST_VERSION });
}
