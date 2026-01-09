export type ConsoleID = 
  'nes' | 'snes' | 
  'gb'  | 'gba'  |
  'gg'  | // game gear
  'sms' | // sega master system
  'pce' | // pc engine
  'n64' |
  'ds'  | '3ds'  |
  'gc'  | 'wii';

export type EmulatorID = 'ares' | 'azahar' |  'dolphin' | 'melonds' | 'mesen'

export type Platform = 'win32' | 'darwin' | 'linux';

export interface Game {
  id: string;
  title: string;
  filePath: string;
  consoleId: ConsoleID;
  coverImage?: string;
}

export interface EngineDependency {
  url: string;
  filename: string;
  sourceName?: string;
  platform: Platform;
}

export interface BiosFile {
  filename: string;
  validHashes?: string[];
  description: string;
}

export interface BiosConfig {
  files: BiosFile[];
  installDir?: string;
}

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

export type EngineInfoDTO = Omit<EngineConfig,
  | "detect"
  | "getLaunchCommand"
  | "postLaunch"
>;

export type EngineStatus = "not_installed" | "installed" | "broken" | "unsupported";

export type EngineInfo = EngineInfoDTO & {
  consoleId: string;

  status: EngineStatus;
  platform: Platform;
  installDir: string;
  installExists: boolean;

  resolvedBinaryPath: string | null;

  needsBios: boolean;
  biosInstalled: boolean;
  biosMissingFiles: string[];

  installSizeBytes: number;
  installMtimeMs: number | null;
  lastError?: string;
};

export interface IpcResponse {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
}

export interface ScanResponse extends IpcResponse {
  type?: 'game' | 'bios';
}

export interface LibraryResponse extends IpcResponse {
  games: Game[];
}