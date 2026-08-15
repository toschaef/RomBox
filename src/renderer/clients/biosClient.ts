import type { ConsoleID } from "../../shared/types";
import type { BiosInstallResponse, BiosGetResponse, BiosDeleteResponse } from "../../shared/types/bios";
import { invoke } from "./invoke";

export const biosClient = {
  installBios: (payload: { consoleId: ConsoleID; filePath: string }) =>
    invoke<BiosInstallResponse>("bios:install", payload),

  getAll: () =>
    invoke<BiosGetResponse>("bios:get"),

  deleteBios: (payload: { consoleId: ConsoleID; fileName: string }) =>
    invoke<BiosDeleteResponse>("bios:delete", payload),
};
