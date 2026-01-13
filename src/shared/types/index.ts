import type { EngineID } from "./engines";

export type ConsoleID =
  'nes' | 'snes' |
  'gb' | 'gba' |
  'gg' | 'sms' |
  'pce' | // pc engine
  'n64' |
  'ds' | '3ds' |
  'gc' | 'wii' |
  'ps1' | 'ps2';

export type Platform = 'win32' | 'darwin' | 'linux';

export interface Game {
  id: string;
  title: string;
  filePath: string;
  consoleId: ConsoleID;
  engineId: EngineID;
  coverImage?: string;
  playtimeSeconds?: number;
};

export interface IpcResponse {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
};

export interface ScanResponse extends IpcResponse {
  type?: 'game' | 'bios';
};

export interface LibraryResponse extends IpcResponse {
  games: Game[];
};