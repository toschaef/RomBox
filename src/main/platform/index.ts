import { MacHandler } from "./MacHandler";
import { WinHandler } from './WinHandler';
import { PlatformHandler } from './types';

const platform = process.platform;

let handler: PlatformHandler;

if (platform === 'darwin') {
  handler = new MacHandler();
} else if (platform === 'win32') {
  handler = new WinHandler(); 
} else {
  throw new Error(`Unsupported OS: ${platform}`);
}

export const osHandler = handler;