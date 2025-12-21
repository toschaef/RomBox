import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import { pipeline } from 'stream/promises';

/** DFS to find file */
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


export interface ZipEntry {
  fileName: string;
  uncompressedSize: number;
}

export const scanZipEntries = (filePath: string): Promise<ZipEntry[]> => {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      const entries: ZipEntry[] = [];
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        // skip directories
        if (!/\/$/.test(entry.fileName)) {
          entries.push({
            fileName: entry.fileName,
            uncompressedSize: entry.uncompressedSize
          });
        }
        zipfile.readEntry();
      });

      zipfile.on('end', () => {
        zipfile.close();
        resolve(entries);
      });

      zipfile.on('error', (err) => reject(err));
    });
  });
};


export const extractZipEntry = (
  zipFilePath: string, 
  entryName: string, 
  destPath: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      let found = false;
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (entry.fileName === entryName) {
          found = true;

          zipfile.openReadStream(entry, async (err, readStream) => {
            if (err) {
              zipfile.close();
              return reject(err);
            }

            try {
              const writeStream = fs.createWriteStream(destPath);
              await pipeline(readStream, writeStream);
              zipfile.close();
              resolve();
            } catch (streamErr) {
              zipfile.close();
              reject(streamErr);
            }
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!found) {
          zipfile.close();
          reject(new Error(`Entry "${entryName}" not found in zip.`));
        }
      });

      zipfile.on('error', (err) => {
        zipfile.close();
        reject(err);
      });
    });
  });
};