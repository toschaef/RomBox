export type ConsoleID = 'nes' | 'snes' | 'gb' | 'gba' | 'ds' | '3ds';
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
}