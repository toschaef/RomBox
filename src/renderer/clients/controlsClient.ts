import type { ControlsProfile, AnyConsoleLayout, ControllerProfileMeta, ConsoleLayoutMeta } from "../../shared/types/controls";
import type { ConsoleID } from "../../shared/types";
import { invoke } from "./invoke";

export const controlsClient = {
  getProfiles: () =>
    invoke<ControllerProfileMeta[]>("controls:getProfiles"),

  getDefaultProfile: () =>
    invoke<ControlsProfile>("controls:getDefaultProfile"),

  getProfile: (id: string) =>
    invoke<ControlsProfile>("controls:getProfile", id),

  createProfile: (payload: {
    name: string;
    copyFromId?: string;
    makeDefault?: boolean;
  }) =>
    invoke<ControlsProfile>("controls:createProfile", payload),

  renameProfile: (payload: { id: string; name: string }) =>
    invoke<ControlsProfile>("controls:renameProfile", payload),

  deleteProfile: (id: string) =>
    invoke<{ ok: true }>("controls:deleteProfile", id),

  setDefault: (id: string) =>
    invoke<ControlsProfile>("controls:setDefault", id),

  saveProfile: (profile: ControlsProfile) =>
    invoke<ControlsProfile>("controls:saveProfile", profile),

  getConsoleLayouts: (profileId: string) =>
    invoke<ConsoleLayoutMeta[]>("controls:getConsoleLayouts", profileId),

  getConsoleLayout: (payload: { consoleId: ConsoleID; profileId: string }) =>
    invoke<AnyConsoleLayout>("controls:getConsoleLayout", payload),

  saveConsoleLayout: (payload: {
    consoleId: ConsoleID;
    profileId: string;
    controllerIds?: Array<string | undefined>;
    player1: unknown;
    player2?: unknown;
    player3?: unknown;
    player4?: unknown;
  }) =>
    invoke<AnyConsoleLayout>("controls:saveConsoleLayout", payload),

  resetConsoleLayout: (payload: { consoleId: ConsoleID; profileId: string }) =>
    invoke<AnyConsoleLayout>("controls:resetConsoleLayout", payload),
};