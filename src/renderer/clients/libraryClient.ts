import type { DropResult, IpcResponse } from "../../shared/types";
import { invoke } from "./invoke";

export const libraryClient = {
  selectFilesOrDirectories: () =>
    invoke<string[]>("select-files-or-directories"),

  processFileDrop: (filePath: string) =>
    invoke<DropResult>("process-file-drop", filePath),

  deleteAllGames: () =>
    invoke<IpcResponse>("game:deleteAll"),

  getPathForFile: (file: File): string => {
    try {
      return window.electron.getPathForFile(file) || (file as File & { path?: string }).path || '';
    } catch (err) {
      console.error('getPathForFile failed', err);
      return (file as File & { path?: string }).path || '';
    }
  },
};
