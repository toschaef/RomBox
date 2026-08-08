import { BaseRepository } from "./BaseRepository";

export class SettingsRepository extends BaseRepository {
  /** Writes each default only where no value exists yet. */
  insertDefaults(defaults: Record<string, unknown>): void {
    const stmt = this.db.prepare("insert or ignore into settings(key, value) values (?, ?)");
    this.db.transaction(() => {
      for (const [key, value] of Object.entries(defaults)) {
        stmt.run(key, JSON.stringify(value));
      }
    })();
  }

  getRaw(key: string): string | null {
    const row = this.db.prepare("select value from settings where key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: unknown): void {
    this.db
      .prepare("insert or replace into settings(key, value) values (?, ?)")
      .run(key, JSON.stringify(value));
  }

  /** Writes every entry, or none if any throws. */
  setMany(entries: Array<[string, unknown]>): void {
    const stmt = this.db.prepare("insert or replace into settings(key, value) values (?, ?)");
    this.db.transaction(() => {
      for (const [key, value] of entries) {
        stmt.run(key, JSON.stringify(value));
      }
    })();
  }
}

export const settingsRepository = new SettingsRepository();
