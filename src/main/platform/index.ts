import { MacHandler } from "./MacHandler";
// import { WinHandler } from './winHandler';
import { PlatformHandler } from './types';

const platform = process.platform;

let handler: PlatformHandler;

if (platform === 'darwin') {
  handler = new MacHandler();
// } else if (platform === 'win32') { <- todo
  // handler = new WinHandler(); 
} else {
  throw new Error(`Unsupported OS: ${platform}`);
}

export const osHandler = handler;