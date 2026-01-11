import type { Game, ConsoleID, Platform } from '..'
import type { BiosConfig, BiosConfigRuntime } from "../bios"

export type EngineID = 'ares' | 'azahar' |  'dolphin' | 'melonds' | 'mesen' | 'rmg';

export interface EngineConfig {
  id: ConsoleID;
  name: string;
  acceptedExtensions: string[];
  installDir?: string;
  bios?: BiosConfig;

  // installation config
  downloads: {
    win32?: string;
    darwin?: string;
    linux?: string;
  };
  binaries: {
    win32?: string;
    darwin?: string;
    linux?: string;
  };
  dependencies?: EngineDependency[];

  // runtime
  detect: (buffer: Buffer) => boolean; 
  getLaunchCommand: (game: Game, emulatorPath: string) => string[];
  postLaunch?: () => void;
}

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

  getLaunchCommand: (game: Game, enginePath: string) => string[];
};

export type EngineDefinitionDTO = Omit<EngineDefinition, "getLaunchCommand" | "postLaunch">;
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