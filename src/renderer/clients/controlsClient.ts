// src/renderer/clients/controlsClient.ts
import type { ActionBindings, LogicalAction, PhysicalBinding } from "../../shared/types/controls";

type ControllerProfileMeta = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  device_hint: string | null;
  layout: string | null;
  is_default: number;
};

type ControllerProfile = ControllerProfileMeta & { bindings: ActionBindings };

export const controlsClient = {
  getProfiles: () =>
    window.electron.invoke("controls:getProfiles") as Promise<ControllerProfileMeta[]>,
  getDefaultProfile: () =>
    window.electron.invoke("controls:getDefaultProfile") as Promise<ControllerProfile>,
  getProfile: (id: string) =>
    window.electron.invoke("controls:getProfile", id) as Promise<ControllerProfile>,
  createProfile: (payload: {
    name: string;
    copyFromId?: string;
    makeDefault?: boolean;
    device_hint?: string | null;
    layout?: string | null;
  }) => window.electron.invoke("controls:createProfile", payload) as Promise<ControllerProfile>,
  renameProfile: (payload: { id: string; name: string }) =>
    window.electron.invoke("controls:renameProfile", payload) as Promise<ControllerProfile>,
  deleteProfile: (id: string) =>
    window.electron.invoke("controls:deleteProfile", id) as Promise<{ ok: true }>,
  setDefault: (id: string) =>
    window.electron.invoke("controls:setDefault", id) as Promise<ControllerProfile>,

  saveBindings: (payload: { profileId: string; bindings: ActionBindings }) =>
    window.electron.invoke("controls:saveBindings", payload) as Promise<ControllerProfile>,
  bindAction: (payload: { profileId: string; action: LogicalAction; input: PhysicalBinding }) =>
    window.electron.invoke("controls:bindAction", payload) as Promise<ControllerProfile>,
  clearAction: (payload: { profileId: string; action: LogicalAction }) =>
    window.electron.invoke("controls:clearAction", payload) as Promise<ControllerProfile>,
  resetAll: (profileId: string) =>
    window.electron.invoke("controls:resetAll", profileId) as Promise<ControllerProfile>,
};
