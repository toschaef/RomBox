import { ipcMain } from "electron";
import { SettingsService } from "../services/SettingsService";
import type { SettingKey, SettingsShape } from "../../shared/settings";

const svc = new SettingsService();

type SetSettingPayload = {
  [K in SettingKey]: { key: K; value: SettingsShape[K] };
}[SettingKey];

export default function registerSettingsHandlers() {
  ipcMain.handle("settings:get", (_e, key: SettingKey) => svc.get(key));

  ipcMain.handle("settings:set", (_e, payload: SetSettingPayload) => {
    return svc.set(payload.key, payload.value as SettingsShape[SettingKey]);
  });

  ipcMain.handle("settings:getMany", (_e, keys: SettingKey[]) => svc.getMany(keys));
  ipcMain.handle("settings:setMany", (_e, values: Partial<SettingsShape>) => svc.setMany(values));

  ipcMain.handle("settings:reset", (_e, key?: SettingKey) => svc.reset(key));
}