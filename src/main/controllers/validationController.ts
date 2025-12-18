import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import AdmZip from 'adm-zip';
import crypto from "crypto";
import type { Game } from "../../shared/types";
import { BIOS_FILENAMES, EXTENSION_MAP } from '../../shared/utils/constants';

function getConsoleId(extension: string) {
  return EXTENSION_MAP[extension.toLowerCase()];
}

type ScanResult = 
  | { type: 'game'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'bios'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'unknown' };

export const validationController = {
  // identify file type
  scanFile: (filePath: string): ScanResult => {
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);

    // check raw bios
    if (BIOS_FILENAMES[filename.toLowerCase()]) {
      return { 
        type: 'bios', 
        consoleId: BIOS_FILENAMES[filename.toLowerCase()], 
        filePath 
      };
    }

    // check zip
    if (ext === '.zip') {
      try {
        const zip = new AdmZip(filePath);
        const entries = zip.getEntries();

        // check for bios in zip
        for (const entry of entries) {
          const entryName = entry.name.toLowerCase();
          if (BIOS_FILENAMES[entryName]) {
            return {
              type: 'bios',
              consoleId: BIOS_FILENAMES[entryName],
              filePath,
              zipEntryName: entry.name
            };
          }
        }

        // check for game in zip
        const validGameEntry = entries.find(entry => {
          if (entry.isDirectory) return false;
          return getConsoleId(path.extname(entry.name)) !== undefined;
        });

        if (validGameEntry) {
          return {
            type: 'game',
            consoleId: getConsoleId(path.extname(validGameEntry.name)),
            filePath,
            zipEntryName: validGameEntry.name
          };
        }
      } catch (e) {
        console.warn("Failed to inspect zip:", e);
      }
    }

    // try raw file
    const consoleId = getConsoleId(ext);
    if (consoleId) {
      return { type: 'game', consoleId, filePath };
    }

    return { type: 'unknown' };
  },
  importGame: (scanResult: ScanResult & { type: 'game' }): Game => {
    const sourceName = scanResult.zipEntryName || path.basename(scanResult.filePath);
    

    let title = sourceName
      .replace(/\.[^/.]+$/, "") // remove extension
      .replace(/\s*\(.*?\)/g, '') // remove (...)
      .replace(/\s*\[.*?\]/g, '') // remove [...]
      .replace(/_/g, ' ')         // replace underscores
      .replace(/[#]/g, '')        // remove #
      .trim();

    const userDataPath = app.getPath('userData');
    const romsDir = path.join(userDataPath, 'roms', scanResult.consoleId);
    if (!fs.existsSync(romsDir)) fs.mkdirSync(romsDir, { recursive: true });

    const destFilename = scanResult.zipEntryName || path.basename(scanResult.filePath);
    const newFilePath = path.join(romsDir, destFilename);

    try {
      // extract and copy
      if (scanResult.zipEntryName) {
        console.log(`Extracting ${scanResult.zipEntryName} to library...`);
        const zip = new AdmZip(scanResult.filePath);
        const entry = zip.getEntry(scanResult.zipEntryName);
        if (entry) {
            fs.writeFileSync(newFilePath, entry.getData());
        }
      } else {
        // copy
        if (scanResult.filePath !== newFilePath) {
          console.log(`Copying ROM to library: ${newFilePath}`);
          fs.copyFileSync(scanResult.filePath, newFilePath);
        }
      }
    } catch (err) {
      console.error("Failed to import ROM:", err);
      throw new Error("Could not import file into library.");
    }

    // return game object
    return {
      id: crypto.randomUUID(),
      title: title, 
      filePath: newFilePath,
      consoleId: scanResult.consoleId as any,
    };
  }
};