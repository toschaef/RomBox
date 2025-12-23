import path from 'path';
import crypto from "crypto";
import fs from 'fs';
import { app } from 'electron';
import { Extractor } from '../utils/extractor';
import { BIOS_FILENAMES, getConsoleIdFromExtension } from '../../shared/constants';
import type { Game, ConsoleID } from '../../shared/types';
import { detectConsoleFromHeader } from '../utils/identifier';
import { scanZipEntries, extractZipEntry } from '../utils/fsUtils';

type ScanResult = 
  | { type: 'game'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'bios'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'unknown' };

interface NormalizedEntry {
  name: string;
  size: number;
}

const identifyConsole = async (
    filename: string, 
    fileSize: number, 
    filePathForHeader?: string
  ): Promise<string | undefined> => {
  const ext = path.extname(filename).toLowerCase();

  const id = getConsoleIdFromExtension(ext);


  if (filePathForHeader && (ext === '.iso' || !id)) {
    const detected = await detectConsoleFromHeader(filePathForHeader);
    if (detected) return detected;
  }

  // handle .rvz wii vs gamecube
  if (ext === '.rvz') {
    const WII_THRESHOLD = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
    if (fileSize > WII_THRESHOLD) return 'wii';
    return 'gc';
  }

  return id;
};

const getArchiveEntries = async (filePath: string): Promise<NormalizedEntry[]> => {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.7z') {
    const entries = await Extractor.list7z(filePath);
    return entries.map(e => ({ name: e.file, size: Number(e.size) || 0 })); 
  }
  
  if (ext === '.zip') {
    const entries = await scanZipEntries(filePath);
    return entries.map(e => ({ name: e.fileName, size: e.uncompressedSize }));
  }

  return [];
};

export const ScannerService = {
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

    // handle archive
    if (['.zip', '.7z'].includes(ext)) {
      try {
        const entries = await getArchiveEntries(filePath);
        console.log(`[Scanner] Found ${entries.length} entries in archive`);

        for (const entry of entries) {
          const entryName = path.basename(entry.name).toLowerCase();
          if (BIOS_FILENAMES[entryName]) {
            return {
              type: 'bios',
              consoleId: BIOS_FILENAMES[entryName],
              filePath,
              zipEntryName: entry.name
            };
          }
        }

        for (const entry of entries) {
          const id = await identifyConsole(entry.name, entry.size);
          if (id) {
            return {
              type: 'game',
              consoleId: id,
              filePath,
              zipEntryName: entry.name
            };
          }
        }
      } catch (err) {
        console.warn(`[Scanner] Failed to inspect archive ${ext}:`, err.message);
      }
    }

    // try raw file
    try {
      const stats = fs.statSync(filePath);
      const id = await identifyConsole(filename, stats.size, filePath);
      
      if (id) {
        return { type: 'game', consoleId: id, filePath };
      }
    } catch (err) {
      console.warn("[Scanner] Error checking raw file:", err.message);
    }
    
    console.log('[Scanner] Warning: file unidentified');
    return { type: 'unknown' };
  },

  importGame: async (scanResult: ScanResult & { type: 'game' }): Promise<Game> => {
    console.log('[Import] Starting import process...');
    const sourceName = scanResult.zipEntryName ? path.basename(scanResult.zipEntryName) : path.basename(scanResult.filePath);
    
    const title = sourceName
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

    // handle duplicates
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

        await Extractor.extract7z(scanResult.filePath, tempDir, scanResult.zipEntryName);

        const extractedFullPath = path.join(tempDir, scanResult.zipEntryName);
        if (!fs.existsSync(path.dirname(newFilePath))) fs.mkdirSync(path.dirname(newFilePath), { recursive: true });

        fs.renameSync(extractedFullPath, newFilePath);
        
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch(err) { console.warn("Failed to clean temp dir", err.message); }
      } 
      // handle zip
      else if (scanResult.zipEntryName) {
        console.log(`[Import] Extracting Zip entry: ${scanResult.zipEntryName}`);

        await extractZipEntry(scanResult.filePath, scanResult.zipEntryName, newFilePath);
      } 
      // handle raw file
      else {
        if (scanResult.filePath !== newFilePath) {
          console.log(`[Import] Copying raw file to library: ${newFilePath}`);
          fs.copyFileSync(scanResult.filePath, newFilePath);
        }
      }
    } catch (err) {
      console.error("[Import] Failed to import ROM:", err.message);
      throw new Error("Could not import file into library.");
    }

    return {
      id: crypto.randomUUID(),
      title: title, 
      filePath: newFilePath,
      consoleId: scanResult.consoleId as ConsoleID,
    };
  },
};