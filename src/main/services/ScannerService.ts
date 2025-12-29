import path from 'path';
import crypto from "crypto";
import fs from 'fs';
import { app } from 'electron';
import { Extractor } from '../utils/extractor';
import { BIOS_FILENAMES, getConsoleIdFromExtension } from '../../shared/constants';
import type { Game, ConsoleID } from '../../shared/types';
import { detectConsoleFromHeader } from '../utils/identifier';
import { scanZipEntries } from '../utils/fsUtils';

export type ScanResult = 
  | { type: 'game'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'bios'; consoleId: string; filePath: string; zipEntryName?: string };

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

  if (ext === '.rvz') {
    const WII_THRESHOLD = 1.5 * 1024 * 1024 * 1024; 
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
  scanPath: async (inputPath: string): Promise<ScanResult[]> => {
    try {
      const stats = fs.statSync(inputPath);
      if (stats.isDirectory()) {
        const dirName = path.basename(inputPath);
        if (dirName.startsWith('.') || dirName === '__MACOSX' || dirName === 'node_modules') {
          return [];
        }
        let results: ScanResult[] = [];
        const entries = fs.readdirSync(inputPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(inputPath, entry.name);
          const childResults = await ScannerService.scanPath(fullPath);
          results = [...results, ...childResults];
        }
        return results;
      }
      return await ScannerService.scanFile(inputPath);
    } catch (err) {
      console.warn(`[Scanner] Error accessing path ${inputPath}:`, err.message);
      return [];
    }
  },

  scanFile: async (filePath: string): Promise<ScanResult[]> => {
    console.log(`[Scanner] Scanning file: ${filePath}`);
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);
    const results: ScanResult[] = [];

    if (BIOS_FILENAMES[filename.toLowerCase()]) {
      return [{ type: 'bios', consoleId: BIOS_FILENAMES[filename.toLowerCase()], filePath }];
    }

    if (['.zip', '.7z'].includes(ext)) {
      try {
        const entries = await getArchiveEntries(filePath);
        console.log(`[Scanner] Found ${entries.length} entries in archive`);

        for (const entry of entries) {
          const entryName = path.basename(entry.name).toLowerCase();
          const entryExt = path.extname(entry.name).toLowerCase();

          if (BIOS_FILENAMES[entryName]) {
            results.push({
              type: 'bios',
              consoleId: BIOS_FILENAMES[entryName],
              filePath,
              zipEntryName: entry.name
            });
            continue;
          }

          if (['.zip', '.7z'].includes(entryExt)) {
             console.log(`[Scanner] Found nested archive: ${entry.name}`);
             
             const tempNestedZip = path.join(app.getPath('temp'), `rombox_nested_${Date.now()}_${path.basename(entry.name)}`);
             
             try {
               await Extractor.extractToFile(filePath, tempNestedZip, entry.name);
               
               const nestedResults = await ScannerService.scanFile(tempNestedZip);
               results.push(...nestedResults);
             } catch (nestedErr) {
               console.warn(`[Scanner] Failed to process nested archive ${entry.name}:`, nestedErr.message);
             }
             continue;
          }

          const id = await identifyConsole(entry.name, entry.size);
          if (id) {
            results.push({
              type: 'game',
              consoleId: id,
              filePath,
              zipEntryName: entry.name
            });
          }
        }
        return results;
      } catch (err) {
        console.warn(`[Scanner] Failed to inspect archive ${ext}:`, err.message);
        return [];
      }
    }

    try {
      const stats = fs.statSync(filePath);
      const id = await identifyConsole(filename, stats.size, filePath);
      if (id) return [{ type: 'game', consoleId: id, filePath }];
    } catch (err) {
      console.warn("[Scanner] Error checking raw file:", err.message);
    }
    
    return [];
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
    
    let destFilename = sourceName;
    let newFilePath = path.join(romsDir, destFilename);

    if (fs.existsSync(newFilePath)) {
      const nameParts = path.parse(sourceName);
      destFilename = `${nameParts.name}_${Date.now()}${nameParts.ext}`;
      newFilePath = path.join(romsDir, destFilename);
    }

    try {
      await Extractor.extractToFile(scanResult.filePath, newFilePath, scanResult.zipEntryName);
    } catch (err) {
      console.error("[Import] Failed to import ROM:", err.message);
      throw new Error("Could not import file into library.");
    }

    return {
      id: crypto.randomUUID(),
      title, 
      filePath: newFilePath,
      consoleId: scanResult.consoleId as ConsoleID,
    };
  },
};