import fs from 'fs';
import path from 'path';

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