import { ipcMain } from "electron";
import { assertConsoleId } from "./validation";
import { controlsService } from "../services/ControlsService";
import type { ControlsProfile, PlayerBindings } from "../../shared/types/controls";
import { ConsoleID } from "../../shared/types";

const svc = controlsService;

function asBindings(value: unknown): PlayerBindings {
  if (!value || typeof value !== "object") {
    throw new Error("Console layout requires player1 bindings");
  }
  return value as PlayerBindings;
}

function asOptionalBindings(value: unknown): PlayerBindings | undefined {
  return value === undefined || value === null ? undefined : asBindings(value);
}

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
      controllerIds?: Array<string | undefined>;
    }) =>
    {
      assertConsoleId(payload.consoleId);
      return svc.saveConsoleLayout({
        consoleId: payload.consoleId,
        profileId: payload.profileId,
        player1: asBindings(payload.player1),
        player2: asOptionalBindings(payload.player2),
        player3: asOptionalBindings(payload.player3),
        player4: asOptionalBindings(payload.player4),
        controllerIds: payload.controllerIds,
      });
    }
  );

  ipcMain.handle("controls:resetConsoleLayout", (_e, payload: { consoleId: ConsoleID; profileId: string }) =>
    svc.resetConsoleLayout(payload.consoleId, payload.profileId)
  );
}