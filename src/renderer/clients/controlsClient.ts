import type { ControlsProfile, AnyConsoleLayout, ControllerProfileMeta, ConsoleLayoutMeta } from "../../shared/types/controls";
import type { ConsoleID } from "../../shared/types";

export const controlsClient = {
  getProfiles: () =>
    window.electron.invoke("controls:getProfiles") as Promise<ControllerProfileMeta[]>,

  getDefaultProfile: () =>
    window.electron.invoke("controls:getDefaultProfile") as Promise<ControlsProfile>,

  getProfile: (id: string) =>
    window.electron.invoke("controls:getProfile", id) as Promise<ControlsProfile>,

  createProfile: (payload: {
    name: string;
    copyFromId?: string;
    makeDefault?: boolean;
  }) =>
    window.electron.invoke("controls:createProfile", payload) as Promise<ControlsProfile>,

  renameProfile: (payload: { id: string; name: string }) =>
    window.electron.invoke("controls:renameProfile", payload) as Promise<ControlsProfile>,

  deleteProfile: (id: string) =>
    window.electron.invoke("controls:deleteProfile", id) as Promise<{ ok: true }>,

  setDefault: (id: string) =>
    window.electron.invoke("controls:setDefault", id) as Promise<ControlsProfile>,

  saveProfile: (profile: ControlsProfile) =>
    window.electron.invoke("controls:saveProfile", profile) as Promise<ControlsProfile>,

  getConsoleLayouts: (profileId: string) =>
    window.electron.invoke("controls:getConsoleLayouts", profileId) as Promise<
      ConsoleLayoutMeta[]
    >,

  getConsoleLayout: (payload: { consoleId: ConsoleID; profileId: string }) =>
    window.electron.invoke("controls:getConsoleLayout", payload) as Promise<AnyConsoleLayout>,

  saveConsoleLayout: (payload: {
    consoleId: ConsoleID;
    profileId: string;
    controllerIds?: Array<string | undefined>;
    player1: unknown;
    player2?: unknown;
    player3?: unknown;
    player4?: unknown;
  }) =>
    window.electron.invoke("controls:saveConsoleLayout", payload) as Promise<AnyConsoleLayout>,

  resetConsoleLayout: (payload: { consoleId: ConsoleID; profileId: string }) =>
    window.electron.invoke("controls:resetConsoleLayout", payload) as Promise<AnyConsoleLayout>,
};