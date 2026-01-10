import type { ConsoleID, IpcResponse } from "..";
import type { EngineID } from "../engines";

export type BiosLevel = "required" | "warning";

export interface BiosFile {
  filename: string;
  description: string;
  validHashes?: string[];
  level?: BiosLevel;
  gameSpecific?: boolean;
}


export interface BiosConfig {
  files: BiosFile[];
  installDir?: string;
  required?: boolean;
  label?: string;
}

export type BiosStatus = {
  consoleId: ConsoleID;
  engineId: EngineID;

  needsBios: boolean;

  biosState: "ok" | "warning" | "missing" | "none";
  missingRequiredFiles: string[];
  missingWarningFiles: string[];
  cachedFiles: string[];
  cachedComplete: boolean;
  cacheMissingFiles: string[];
  required: boolean;
  firmwareDir: string;
  cacheDir: string;
};


export type BiosGetResponse = IpcResponse & { items?: BiosStatus[] };

export type BiosInstallResponse = IpcResponse & {
  consoleId?: ConsoleID;
  installed?: string[];

  biosState?: "ok" | "warning" | "missing" | "none";
  missingRequiredFiles?: string[];
  missingWarningFiles?: string[];
};

export type BiosDeleteResponse = IpcResponse & {
  consoleId?: ConsoleID;
  fileName?: string;
  deleted?: number;

  biosState?: "ok" | "warning" | "missing" | "none";
  missingRequiredFiles?: string[];
  missingWarningFiles?: string[];
};