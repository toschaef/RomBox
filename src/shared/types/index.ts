export type ConsoleID = 'nes';

export interface Game {
  id: string;
  title: string;
  filePath: string;
  consoleId: ConsoleID;
  coverImage?: string;
}

export interface EmulatorConfig {
  id: ConsoleID;
  name: string;
  executableName: string;
  acceptedExtensions: string[];

  detect: (buffer: Buffer) => boolean; 
  getLaunchCommand: (game: Game, emulatorPath: string) => string[];
}