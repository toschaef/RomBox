import path from 'path';
import fs from 'fs';
import type { ConsoleID } from '../types';

export const EXTENSION_MAP: Record<string, ConsoleID> = {
  '.nes': 'nes',
  '.unf': 'nes',
};

export const ACCEPTED_EXTENSIONS = [
  '.nes',
  '.unf',
  '.zip',
].join(',');

export const ENGINE_MAP: Record<string, string> = {
  'nes': 'Mesen',
};

// DFS to find file
export const findFile = (dir: string, filename: string): string | null => {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === filename) return path.join(dir, file);
    }

    // check subdirectories
    for (const file of files) {
      const fullPath = path.join(dir, file);
      // make sure not symlink
      const stat = fs.lstatSync(fullPath);
      if (stat.isDirectory()) {
        const found = findFile(fullPath, filename);
        if (found) return found;
      }
    }
  } catch (e) {}
  return null;
};