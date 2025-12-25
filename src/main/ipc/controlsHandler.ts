import { ipcMain } from "electron";
import { ControlsService } from "../services/ControlsService";
import type { LogicalAction, PhysicalBinding, ActionBindings } from "../../shared/types/controls";

const svc = new ControlsService();

export default function registerControlsHandlers() {
  ipcMain.handle("controls:getProfiles", () => svc.getProfiles());
  ipcMain.handle("controls:getDefaultProfile", () => svc.getDefaultProfile());
  ipcMain.handle("controls:getProfile", (_e, id: string) => svc.getProfile(id));

  ipcMain.handle(
    "controls:createProfile",
    (_e, payload: { name: string; copyFromId?: string; makeDefault?: boolean; device_hint?: string | null; layout?: string | null }) =>
      svc.createProfile(payload)
  );

  ipcMain.handle("controls:renameProfile", (_e, payload: { id: string; name: string }) =>
    svc.renameProfile(payload.id, payload.name)
  );

  ipcMain.handle("controls:setDefault", (_e, id: string) => svc.setDefault(id));
  ipcMain.handle("controls:deleteProfile", (_e, id: string) => svc.deleteProfile(id));

  ipcMain.handle(
    "controls:saveBindings",
    (_e, payload: { profileId: string; bindings: ActionBindings }) => svc.saveBindings(payload.profileId, payload.bindings)
  );

  ipcMain.handle(
    "controls:bindAction",
    (_e, payload: { profileId: string; action: LogicalAction; input: PhysicalBinding }) =>
      svc.bindAction(payload.profileId, payload.action, payload.input)
  );

  ipcMain.handle(
    "controls:clearAction",
    (_e, payload: { profileId: string; action: LogicalAction }) =>
      svc.clearAction(payload.profileId, payload.action)
  );

  ipcMain.handle("controls:resetAll", (_e, profileId: string) => svc.resetAll(profileId));
}
