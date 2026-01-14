import type { ConsoleID, IpcResponse } from "..";
import type { EngineID } from "../engines";


export interface SaveMetadata {
  gameId: string;
  gameName: string;
  gameFileName: string;
  consoleId: ConsoleID;
  engineId: EngineID;
  fileName: string;
  cachedAt: number;
  sizeBytes: number;
}

export interface SaveStatus {
  gameId: string;
  gameName: string;
  gameFileName: string;
  consoleId: ConsoleID;
  engineId: EngineID;
  hasCachedSave: boolean;
  cachedFiles: SaveMetadata[];
  emulatorSaveDir: string;
  cacheDir: string;
}

export type SaveGetStatusResponse = IpcResponse & {
  status?: SaveStatus;
};

export type SaveBackupResponse = IpcResponse & {
  gameId?: string;
  backedUpFiles?: string[];
};

export type SaveRestoreResponse = IpcResponse & {
  gameId?: string;
  restoredFiles?: string[];
};

export type SaveDeleteResponse = IpcResponse & {
  gameId?: string;
  deletedFiles?: string[];
};

export type SaveListResponse = IpcResponse & {
  saves?: SaveStatus[];
};

export type SaveExportResponse = IpcResponse & {
  gameId?: string;
  exportedTo?: string;
};
