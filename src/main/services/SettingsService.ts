import { settingsRepository } from "../data/repositories/SettingsRepository";
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
    case "launch.resolution":
      return typeof value === "number";
    default:
      return false;
  }
}

export class SettingsService {
  ensureDefaults() {
    settingsRepository.insertDefaults(SETTINGS_DEFAULTS);
  }

  get<K extends SettingKey>(key: K): SettingsShape[K] {
    this.ensureDefaults();

    const raw = settingsRepository.getRaw(key);
    if (raw === null) return SETTINGS_DEFAULTS[key];

    try {
      const parsed = JSON.parse(raw);
      if (validate(key, parsed)) return parsed;
      return SETTINGS_DEFAULTS[key];
    } catch {
      return SETTINGS_DEFAULTS[key];
    }
  }

  set<K extends SettingKey>(key: K, value: SettingsShape[K]) {
    log.debug('Setting value', { key, value });
    this.ensureDefaults();

    if (!validate(key, value)) {
      log.warn('Invalid value for setting', { key, value });
      throw new Error(`Invalid value for setting "${key}"`);
    }

    settingsRepository.set(key, value);

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

    const entries: Array<[string, unknown]> = [];
    for (const [k, v] of Object.entries(values)) {
      const key = k as SettingKey;
      if (v === undefined) continue;
      if (!validate(key, v)) {
        log.warn('Invalid value in setMany', { key, value: v });
        throw new Error(`Invalid value for setting "${key}"`);
      }
      entries.push([key, v]);
    }
    settingsRepository.setMany(entries);

    return { success: true };
  }

  reset(key?: SettingKey) {
    log.info('Resetting settings', { key: key ?? 'all' });
    this.ensureDefaults();

    if (key) {
      settingsRepository.set(key, SETTINGS_DEFAULTS[key]);
      return { success: true };
    }

    settingsRepository.setMany(Object.entries(SETTINGS_DEFAULTS));
    log.info('All settings reset to defaults');

    return { success: true };
  }
}

export const settingsService = new SettingsService();
