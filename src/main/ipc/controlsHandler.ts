import { ipcMain } from "electron";
import { ControlsService } from "../services/ControlsService";
import type { ControlsProfile } from "../../shared/controls/types";

const svc = new ControlsService();

export default function registerControlsHandlers() {
  ipcMain.handle("controls:getProfiles", () => svc.getProfiles());
  ipcMain.handle("controls:getDefaultProfile", () => svc.getDefaultProfile());
  ipcMain.handle("controls:getProfile", (_e, id: string) => svc.getProfile(id));

  ipcMain.handle(
    "controls:createProfile",
    (_e, payload: { name: string; copyFromId?: string; makeDefault?: boolean }) => svc.createProfile(payload)
  );

  ipcMain.handle("controls:renameProfile", (_e, payload: { id: string; name: string }) =>
    svc.renameProfile(payload.id, payload.name)
  );

  ipcMain.handle("controls:setDefault", (_e, id: string) => svc.setDefault(id));
  ipcMain.handle("controls:deleteProfile", (_e, id: string) => svc.deleteProfile(id));

  ipcMain.handle("controls:saveProfile", (_e, profile: ControlsProfile) => svc.saveProfile(profile));
}
