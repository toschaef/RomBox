import type { ConsoleID, IpcResponse } from "../../shared/types";
import type { EngineID, EngineInfo } from "../../shared/types/engines";

export const engineClient = {
  installEngine: (engineId: EngineID) =>
    window.electron.invoke("engine:install-engine", engineId) as Promise<IpcResponse>,

  deleteEngine: (engineId: EngineID) => 
    window.electron.invoke("engine:delete-engine", engineId) as Promise<IpcResponse>,

  isInstalled: (engineId: EngineID) =>
    window.electron.invoke("engine:is-installed", engineId) as Promise<boolean>,

  getEngines: () =>
    window.electron.invoke("engine:get") as Promise<EngineInfo[]>,

  repairEngine: async (engineId: ConsoleID) => {
    await window.electron.invoke("engine:delete-engine", engineId);
    return window.electron.invoke("engine:install-engine", engineId) as Promise<IpcResponse>
  },

  clear: () =>
    window.electron.invoke("engine:clear") as Promise<IpcResponse>,

  onInstallStatusUpdate: (cb: (status: string) => void) =>
    window.electron.on("install-status-update", (status: string) => cb(status)),
};
