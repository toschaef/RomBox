import { getDB } from "../data/db";
import {
  SETTINGS_DEFAULTS,
  type SettingKey,
  type SettingsShape,
} from "../../shared/settings";
import { Logger } from "../utils/logger";

const log = Logger.create('SettingsService');

function validate<K extends SettingKey>(key: K, value: unknown): value is SettingsShape[K] {
  switch (key) {
    case "ui.fullscreen":
    case "launch.closeOnExit":
    case "launch.fullscreen":
    case "setup.autoInstallEngines":
      return typeof value === "boolean";
    case "controls.activeProfileId":
      return typeof value === "string";
    default:
      return false;
  }
}

export class SettingsService {
  ensureDefaults() {
    const db = getDB();
    const stmt = db.prepare(`INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)`);
    const tx = db.transaction(() => {
      for (const [key, def] of Object.entries(SETTINGS_DEFAULTS)) {
        stmt.run(key, JSON.stringify(def));
      }
    });
    tx();
  }

  get<K extends SettingKey>(key: K): SettingsShape[K] {
    this.ensureDefaults();
    const db = getDB();

    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;

    if (!row) return SETTINGS_DEFAULTS[key];

    try {
      const parsed = JSON.parse(row.value);
      if (validate(key, parsed)) return parsed;
      return SETTINGS_DEFAULTS[key];
    } catch {
      return SETTINGS_DEFAULTS[key];
    }
  }

  set<K extends SettingKey>(key: K, value: SettingsShape[K]) {
    log.debug('Setting value', { key, value });
    const db = getDB();
    this.ensureDefaults();

    if (!validate(key, value)) {
      log.warn('Invalid value for setting', { key, value });
      throw new Error(`Invalid value for setting "${key}"`);
    }

    db
      .prepare(`INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)`)
      .run(key, JSON.stringify(value));

    return { success: true };
  }

  getMany<K extends SettingKey>(keys: K[]): Pick<SettingsShape, K> {
    this.ensureDefaults();
    const out: Partial<SettingsShape> = {};

    for (const k of keys) {
      out[k] = this.get(k);
    }
    return out as Pick<SettingsShape, K>;
  }

  setMany(values: Partial<SettingsShape>) {
    log.debug('Setting multiple values', { keys: Object.keys(values) });
    this.ensureDefaults();

    const db = getDB();
    const stmt = db.prepare(`INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)`);
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(values)) {
        const key = k as SettingKey;
        if (v === undefined) continue;
        if (!validate(key, v)) {
          log.warn('Invalid value in setMany', { key, value: v });
          throw new Error(`Invalid value for setting "${key}"`);
        }
        stmt.run(key, JSON.stringify(v));
      }
    });
    tx();

    return { success: true };
  }

  reset(key?: SettingKey) {
    log.info('Resetting settings', { key: key ?? 'all' });
    this.ensureDefaults();
    const db = getDB();

    if (key) {
      db.prepare(`INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)`)
        .run(key, JSON.stringify(SETTINGS_DEFAULTS[key]));
      return { success: true };
    }

    const stmt = db.prepare(`INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)`);
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(SETTINGS_DEFAULTS)) {
        stmt.run(k, JSON.stringify(v));
      }
    });
    tx();
    log.info('All settings reset to defaults');

    return { success: true };
  }
}
