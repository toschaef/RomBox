import type { SettingKey, SettingsShape } from "../../shared/settings";
import { invoke } from "./invoke";

export const settingsClient = {
  get: <K extends SettingKey>(key: K) =>
    invoke<SettingsShape[K]>("settings:get", key),

  set: <K extends SettingKey>(key: K, value: SettingsShape[K]) =>
    invoke<{ ok: true }>("settings:set", { key, value }),

  getMany: (keys: SettingKey[]) =>
    invoke<Partial<SettingsShape>>("settings:getMany", keys),

  setMany: (values: Partial<SettingsShape>) =>
    invoke<{ ok: true }>("settings:setMany", values),

  reset: (key?: SettingKey) =>
    invoke<{ ok: true }>("settings:reset", key),
};
