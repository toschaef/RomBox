import type { ConsoleID, EmulatorID, IpcResponse, EngineInfo } from "../../shared/types";

export const engineClient = {
  installEngine: (emulatorId: EmulatorID) =>
    window.electron.invoke("engine:install-engine", emulatorId) as Promise<IpcResponse>,

  deleteEngine: (emulatorId: EmulatorID) => 
    window.electron.invoke("engine:delete-engine", emulatorId) as Promise<IpcResponse>,

  isInstalled: (consoleId: ConsoleID) =>
    window.electron.invoke("engine:is-installed", consoleId) as Promise<boolean>,

  getEngines: () =>
    window.electron.invoke("engine:get-engines") as Promise<EngineInfo[]>,

  repairEngine: async (emulatorId: ConsoleID) => {
    await window.electron.invoke("engine:delete-engine", emulatorId);
    return window.electron.invoke("engine:install-engine", emulatorId) as Promise<IpcResponse>
  },

  installBios: (payload: { consoleId: ConsoleID; filePath: string }) =>
    window.electron.invoke("engine:install-bios", payload) as Promise<IpcResponse & { installed?: string[] }>,

  clear: () =>
    window.electron.invoke("engine:clear") as Promise<IpcResponse>,

  onInstallStatusUpdate: (cb: (status: string) => void) =>
    window.electron.on("install-status-update", (status: string) => cb(status)),
};
