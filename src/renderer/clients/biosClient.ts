import type { ConsoleID } from "../../shared/types";
import type { BiosInstallResponse, BiosGetResponse, BiosDeleteResponse } from "../../shared/types/bios";

export const biosClient = {
  installBios: (payload: { consoleId: ConsoleID; filePath: string }) =>
    window.electron.invoke("bios:install", payload) as Promise<BiosInstallResponse>,

  getAll: () =>
    window.electron.invoke("bios:get") as Promise<BiosGetResponse>,

  deleteBios: (payload: { consoleId: ConsoleID; fileName: string }) =>
    window.electron.invoke("bios:delete", payload) as Promise<BiosDeleteResponse>,
};
