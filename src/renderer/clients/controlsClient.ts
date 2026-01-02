import type { ControlsProfile } from "../../shared/controls/types";
import type { ProfileMeta } from "../../shared/controls/types";

export const controlsClient = {
  getProfiles: () => window.electron.invoke("controls:getProfiles") as Promise<ProfileMeta[]>,
  getDefaultProfile: () => window.electron.invoke("controls:getDefaultProfile") as Promise<ControlsProfile>,
  getProfile: (id: string) => window.electron.invoke("controls:getProfile", id) as Promise<ControlsProfile>,

  createProfile: (payload: { name: string; copyFromId?: string; makeDefault?: boolean }) =>
    window.electron.invoke("controls:createProfile", payload) as Promise<ControlsProfile>,

  renameProfile: (payload: { id: string; name: string }) =>
    window.electron.invoke("controls:renameProfile", payload) as Promise<ControlsProfile>,

  deleteProfile: (id: string) => window.electron.invoke("controls:deleteProfile", id) as Promise<{ ok: true }>,
  setDefault: (id: string) => window.electron.invoke("controls:setDefault", id) as Promise<ControlsProfile>,

  saveProfile: (profile: ControlsProfile) =>
    window.electron.invoke("controls:saveProfile", profile) as Promise<ControlsProfile>,
};
