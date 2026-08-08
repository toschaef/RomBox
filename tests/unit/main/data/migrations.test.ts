// drives the runner against a fake db that tracks user_version the way sqlite
// does. what is under test is the versioning logic, not sqlite.
import type Database from "better-sqlite3";
import {
  LATEST_VERSION,
  MIGRATIONS,
  runMigrations,
} from "../../../../src/main/data/migrations";

interface FakeDb {
  version: number;
  columns: Record<string, string[]>;
  executed: string[];
}

function makeDb(overrides: Partial<FakeDb> = {}): FakeDb & Database.Database {
  const state: FakeDb = {
    version: 0,
    // a database created from schema.ts already has every column.
    columns: {
      games: ["id", "title", "filePath", "consoleId", "engineId", "playtime_seconds", "last_played_at"],
      console_layouts: [
        "id", "console_id", "profile_id", "created_at", "updated_at",
        "is_user_modified", "controller_id",
        "player2_controller_id", "player3_controller_id", "player4_controller_id",
        "bindings_json",
      ],
    },
    executed: [],
    ...overrides,
  };

  const db = {
    ...state,
    pragma(str: string) {
      const assignment = /^user_version = (\d+)$/.exec(str);
      if (assignment) {
        db.version = Number(assignment[1]);
        return undefined;
      }
      if (str === "user_version") return [{ user_version: db.version }];
      return undefined;
    },
    prepare(sql: string) {
      const table = /PRAGMA table_info\((\w+)\)/.exec(sql)?.[1];
      return {
        all: () => (db.columns[table ?? ""] ?? []).map((name) => ({ name })),
      };
    },
    exec(sql: string) {
      db.executed.push(sql);
      const added = /ALTER TABLE (\w+) ADD COLUMN (\w+)/.exec(sql);
      if (added) {
        const [, table, column] = added;
        db.columns[table] = [...(db.columns[table] ?? []), column];
      }
    },
  } as unknown as FakeDb & Database.Database;

  return db;
}

describe("runMigrations", () => {
  it("declares migrations in strictly ascending order", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(LATEST_VERSION).toBe(Math.max(...versions));
  });

  it("stamps a fresh database at the latest version", () => {
    const db = makeDb();
    runMigrations(db);
    expect(db.version).toBe(LATEST_VERSION);
  });

  it("adds nothing when the schema already has every column", () => {
    // installs created from schema.ts start at version 0 with the columns
    // present; the migrations must be no-ops rather than erroring.
    const db = makeDb();
    runMigrations(db);
    expect(db.executed).toEqual([]);
  });

  it("adds the columns an old database is missing", () => {
    const db = makeDb({
      columns: {
        games: ["id", "title", "filePath", "consoleId", "engineId", "playtime_seconds"],
        console_layouts: [
          "id", "console_id", "profile_id", "created_at", "updated_at",
          "is_user_modified", "bindings_json",
        ],
      },
    });

    runMigrations(db);

    expect(db.columns.games).toContain("last_played_at");
    expect(db.columns.console_layouts).toEqual(
      expect.arrayContaining([
        "controller_id",
        "player2_controller_id",
        "player3_controller_id",
        "player4_controller_id",
      ])
    );
    expect(db.version).toBe(LATEST_VERSION);
  });

  it("does no work when already at the latest version", () => {
    const db = makeDb({ version: LATEST_VERSION });
    runMigrations(db);
    expect(db.executed).toEqual([]);
  });

  it("skips migrations at or below the recorded version", () => {
    // version 1 is applied; only 2 and 3 should run, so a games table missing
    // last_played_at stays missing.
    const db = makeDb({
      version: 1,
      columns: {
        games: ["id", "title"],
        console_layouts: ["id", "console_id", "profile_id"],
      },
    });

    runMigrations(db);

    expect(db.columns.games).not.toContain("last_played_at");
    expect(db.columns.console_layouts).toContain("controller_id");
    expect(db.version).toBe(LATEST_VERSION);
  });

  it("is idempotent across repeated boots", () => {
    const db = makeDb({
      columns: { games: ["id"], console_layouts: ["id"] },
    });

    runMigrations(db);
    const afterFirst = [...db.executed];

    runMigrations(db);
    expect(db.executed).toEqual(afterFirst);
  });
});
