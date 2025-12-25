import type { SettingKey, SettingsShape } from "../../shared/settings";

export const settingsClient = {
  get: <K extends SettingKey>(key: K) =>
    window.electron.invoke("settings:get", key) as Promise<SettingsShape[K]>,

  set: <K extends SettingKey>(key: K, value: SettingsShape[K]) =>
    window.electron.invoke("settings:set", { key, value }) as Promise<{ ok: true }>,

  getMany: (keys: SettingKey[]) =>
    window.electron.invoke("settings:getMany", keys) as Promise<Partial<SettingsShape>>,

  setMany: (values: Partial<SettingsShape>) =>
    window.electron.invoke("settings:setMany", values) as Promise<{ ok: true }>,

  reset: (key?: SettingKey) =>
    window.electron.invoke("settings:reset", key) as Promise<{ ok: true }>,
};
