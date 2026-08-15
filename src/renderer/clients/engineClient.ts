import type { IpcResponse } from "../../shared/types";
import type { EngineID, EngineInfo } from "../../shared/types/engines";
import { invoke, on } from "./invoke";

export const engineClient = {
  installEngine: (engineId: EngineID) =>
    invoke<IpcResponse>("engine:install-engine", engineId),

  deleteEngine: (engineId: EngineID) => 
    invoke<IpcResponse>("engine:delete-engine", engineId),

  isInstalled: (engineId: EngineID) =>
    invoke<boolean>("engine:is-installed", engineId),

  getEngines: () =>
    invoke<EngineInfo[]>("engine:get"),

  repairEngine: async (engineId: EngineID) => {
    await invoke<IpcResponse>("engine:delete-engine", engineId);
    return invoke<IpcResponse>("engine:install-engine", engineId)
  },

  clear: () =>
    invoke<IpcResponse>("engine:clear"),

  onInstallStatusUpdate: (cb: (status: string) => void) =>
    on("install-status-update", ((status: string) => cb(status)) as never),
};
