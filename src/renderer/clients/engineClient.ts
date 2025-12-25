import type { ConsoleID, IpcResponse } from "../../shared/types";

export const engineClient = {
  install: (consoleId: ConsoleID) =>
    window.electron.invoke("engine:install", consoleId) as Promise<IpcResponse>,

  isInstalled: (consoleId: ConsoleID) =>
    window.electron.invoke("engine:is-installed", consoleId) as Promise<boolean>,

  installBios: (payload: { consoleId: ConsoleID; filePath: string }) =>
    window.electron.invoke("engine:install-bios", payload) as Promise<IpcResponse & { installed?: string[] }>,

  clear: () =>
    window.electron.invoke("engine:clear") as Promise<IpcResponse>,

  onInstallStatusUpdate: (cb: (status: string) => void) =>
    window.electron.on("install-status-update", (status: string) => cb(status)),
};
