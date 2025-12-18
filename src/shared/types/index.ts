export type ConsoleID = 'nes' | 'snes' | 'gb' | 'gba' ;
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
  filename: string; // name to save file as
  sourceName?: string; // name inside download if different
  platform: Platform;
}

export interface EngineConfig {
  id: ConsoleID;
  name: string;
  acceptedExtensions: string[];

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