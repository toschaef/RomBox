import { ipcMain } from "electron";
import { ControlsService } from "../services/ControlsService";
import type { ControlsProfile, PlayerBindings } from "../../shared/types/controls";
import { ConsoleID } from "../../shared/types";

const svc = new ControlsService();

export default function registerControlsHandlers() {
  ipcMain.handle("controls:getProfiles", () => svc.getProfiles());
  ipcMain.handle("controls:getDefaultProfile", () => svc.getDefaultProfile());
  ipcMain.handle("controls:getProfile", (_e, id: string) => svc.getProfile(id));

  ipcMain.handle("controls:createProfile", (_e, payload: { name: string; copyFromId?: string; makeDefault?: boolean }) =>
    svc.createProfile(payload)
  );

  ipcMain.handle("controls:renameProfile", (_e, payload: { id: string; name: string }) =>
    svc.renameProfile(payload.id, payload.name)
  );

  ipcMain.handle("controls:setDefault", (_e, id: string) => svc.setDefault(id));
  ipcMain.handle("controls:deleteProfile", (_e, id: string) => svc.deleteProfile(id));
  ipcMain.handle("controls:saveProfile", (_e, profile: ControlsProfile) => svc.saveProfile(profile));

  ipcMain.handle("controls:getConsoleLayouts", (_e, profileId: string) => svc.getConsoleLayouts(profileId));

  ipcMain.handle("controls:getConsoleLayout", (_e, payload: { consoleId: ConsoleID; profileId: string }) =>
    svc.getConsoleLayout(payload.consoleId, payload.profileId)
  );

  ipcMain.handle(
    "controls:saveConsoleLayout",
    (_e, payload: {
      consoleId: ConsoleID;
      profileId: string;
      player1: unknown;
      player2?: unknown;
      player3?: unknown;
      player4?: unknown;
      controllerId?: string;
      player2ControllerId?: string;
      player3ControllerId?: string;
      player4ControllerId?: string;
    }) =>
      svc.saveConsoleLayout({
        consoleId: payload.consoleId,
        profileId: payload.profileId,
        player1: payload.player1 as PlayerBindings,
        player2: payload.player2 as PlayerBindings | undefined,
        player3: payload.player3 as PlayerBindings | undefined,
        player4: payload.player4 as PlayerBindings | undefined,
        controllerId: payload.controllerId,
        player2ControllerId: payload.player2ControllerId,
        player3ControllerId: payload.player3ControllerId,
        player4ControllerId: payload.player4ControllerId,
      })
  );

  ipcMain.handle("controls:resetConsoleLayout", (_e, payload: { consoleId: ConsoleID; profileId: string }) =>
    svc.resetConsoleLayout(payload.consoleId, payload.profileId)
  );
}