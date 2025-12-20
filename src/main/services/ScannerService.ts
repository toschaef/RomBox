import path from 'path';
import AdmZip from 'adm-zip';
import crypto from "crypto";
import fs from 'fs';
import { app } from 'electron';
import { Extractor } from '../utils/extractor';
import { BIOS_FILENAMES } from '../../shared/constants';
import { getConsoleIdFromExtension } from '../../shared/constants';
import type { Game } from '../../shared/types';

type ScanResult = 
  | { type: 'game'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'bios'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'unknown' };

export const ScannerService = {
     // ... (Your existing scan logic, but calling Extractor.list7z instead of list7z) ...
  scanFile: async (filePath: string): Promise<ScanResult> => {
    console.log(`[Scanner] Scanning file: ${filePath}`);
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);

    // handle raw bios
    if (BIOS_FILENAMES[filename.toLowerCase()]) {
      return { 
        type: 'bios', 
        consoleId: BIOS_FILENAMES[filename.toLowerCase()], 
        filePath 
      };
    }

    // handle .7z
    if (ext === '.7z') {
      try {
        const entries = await Extractor.list7z(filePath);
        
        // check for bios in 7z
        for (const entry of entries) {
          const entryName = path.basename(entry.file).toLowerCase(); 
          if (BIOS_FILENAMES[entryName]) {
            console.log(`[Scanner] Found BIOS in 7z: ${entryName}`);
            return {
              type: 'bios',
              consoleId: BIOS_FILENAMES[entryName],
              filePath,
              zipEntryName: entry.file
            };
          }
        }

        // check for game in 7z
        const validGameEntry = entries.find(entry => {
          if (entry.attr && entry.attr.includes('D')) return false; 
          
          const id = getConsoleIdFromExtension(path.extname(entry.file));
          if (id) {
            console.log(`[Scanner] Found Game Candidate: ${entry.file} (${id})`);
            return true;
          }
          return false;
        });

        if (validGameEntry) {
          return {
            type: 'game',
            consoleId: getConsoleIdFromExtension(path.extname(validGameEntry.file)),
            filePath,
            zipEntryName: validGameEntry.file
          };
        }
      } catch (e) {
        console.warn("Failed to inspect 7z:", e);
      }
    }

    // handle zip
    if (ext === '.zip') {
      try {
        const zip = new AdmZip(filePath);
        const entries = zip.getEntries();

        for (const entry of entries) {
          const entryName = entry.name.toLowerCase();
          if (BIOS_FILENAMES[entryName]) {
            return {
              type: 'bios',
              consoleId: BIOS_FILENAMES[entryName],
              filePath,
              zipEntryName: entry.entryName
            };
          }
        }

        const validGameEntry = entries.find(entry => {
          if (entry.isDirectory) return false;
          return getConsoleIdFromExtension(path.extname(entry.name)) !== undefined;
        });

        if (validGameEntry) {
          return {
            type: 'game',
            consoleId: getConsoleIdFromExtension(path.extname(validGameEntry.name)),
            filePath,
            zipEntryName: validGameEntry.entryName
          };
        }
      } catch (e) {
        console.warn("Failed to inspect zip:", e);
      }
    }

    // try raw file
    const consoleId = getConsoleIdFromExtension(ext);
    if (consoleId) {
      return { type: 'game', consoleId, filePath };
    }

    return { type: 'unknown' };
  },

  importGame: async (scanResult: ScanResult & { type: 'game' }): Promise<Game> => {
    console.log('[Import] Starting import process...');
    const sourceName = scanResult.zipEntryName ? path.basename(scanResult.zipEntryName) : path.basename(scanResult.filePath);
    
    let title = sourceName
      .replace(/\.[^/.]+$/, "") 
      .replace(/\s*\(.*?\)/g, '') 
      .replace(/\s*\[.*?\]/g, '') 
      .replace(/_/g, ' ')         
      .replace(/[#]/g, '')        
      .trim();

    const userDataPath = app.getPath('userData');
    const romsDir = path.join(userDataPath, 'roms', scanResult.consoleId);
    if (!fs.existsSync(romsDir)) fs.mkdirSync(romsDir, { recursive: true });

    let destFilename = sourceName;
    let newFilePath = path.join(romsDir, destFilename);

    if (fs.existsSync(newFilePath)) {
      const nameParts = path.parse(sourceName);
      destFilename = `${nameParts.name}_${Date.now()}${nameParts.ext}`;
      newFilePath = path.join(romsDir, destFilename);
    }

    try {
      const ext = path.extname(scanResult.filePath).toLowerCase();

      // handle 7z
      if (ext === '.7z' && scanResult.zipEntryName) {
        const tempDir = path.join(app.getPath('temp'), 'rombox_extract_' + crypto.randomUUID());
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        await Extractor.extract7z(scanResult.filePath, scanResult.zipEntryName, tempDir);

        const extractedFullPath = path.join(tempDir, scanResult.zipEntryName);
        if (!fs.existsSync(path.dirname(newFilePath))) fs.mkdirSync(path.dirname(newFilePath), { recursive: true });

        fs.renameSync(extractedFullPath, newFilePath);
        
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch(e) { console.warn("Failed to clean temp dir", e); }
      } 
      // handle zip
      else if (scanResult.zipEntryName) {
        console.log(`[Import] Extracting Zip entry: ${scanResult.zipEntryName}`);
        const zip = new AdmZip(scanResult.filePath);
        const entry = zip.getEntry(scanResult.zipEntryName);
        if (entry) {
            fs.writeFileSync(newFilePath, entry.getData());
        }
      } 
      // handle raw file
      else {
        if (scanResult.filePath !== newFilePath) {
          console.log(`[Import] Copying raw file to library: ${newFilePath}`);
          fs.copyFileSync(scanResult.filePath, newFilePath);
        }
      }
    } catch (err) {
      console.error("[Import] Failed to import ROM:", err);
      throw new Error("Could not import file into library.");
    }

    return {
      id: crypto.randomUUID(),
      title: title, 
      filePath: newFilePath,
      consoleId: scanResult.consoleId as any,
    };
  },
};