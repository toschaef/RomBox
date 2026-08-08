import type { Game, ConsoleID, Platform } from '..'
import type { BiosConfigRuntime } from "../bios"

export type EngineID = 'ares' | 'azahar' | 'dolphin' | 'duckstation' | 'melonds' | 'mesen' | 'pcsx2';

export type LaunchOptions = {
  fullscreen?: boolean;
};

export interface EngineDependency {
  url: string;
  filename: string;
  sourceName?: string;
  platform: Platform;
}

export type ConsoleDefinition = {
  consoleId: ConsoleID;
  acceptedExtensions: string[];
  detect: (buffer: Buffer) => boolean;
  bios?: BiosConfigRuntime;
};

export type EngineDefinition = {
  engineId: EngineID;
  name: string;

  consoles: ConsoleID[];

  downloads: Partial<Record<Platform, string>>;
  binaries: Partial<Record<Platform, string>>;
  dependencies?: EngineDependency[];

  getLaunchCommand: (game: Game, enginePath: string, options?: LaunchOptions) => string[];
};

export type EngineDefinitionDTO = Omit<EngineDefinition, "getLaunchCommand">;
export type EngineStatus = "not_installed" | "installed" | "broken" | "unsupported";
export type EngineBiosState = "ok" | "warning" | "missing" | "none";


export type EngineInfo = EngineDefinitionDTO & {
  status: EngineStatus;
  platform: Platform;

  installDirAbs: string;
  installExists: boolean;
  resolvedBinaryPath: string | null;

  installSizeBytes: number;
  installMtimeMs: number | null;

  needsBios: boolean;

  biosState: EngineBiosState;
  biosMissingRequired: Array<{ consoleId: ConsoleID; filename: string }>;
  biosMissingWarning: Array<{ consoleId: ConsoleID; filename: string }>;

  lastError?: string;
};