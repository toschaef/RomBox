import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import AdmZip from 'adm-zip';
import crypto from "crypto";
import sevenBin from '7zip-bin';
import { execFile, spawn } from 'child_process';
import type { Game } from "../../shared/types";
import { BIOS_FILENAMES, EXTENSION_MAP } from '../../shared/utils/constants';

const pathTo7zip = sevenBin.path7za;

if (process.platform !== 'win32') {
  try {
    if (fs.existsSync(pathTo7zip)) {
      fs.chmodSync(pathTo7zip, '755');
    }
  } catch (e) {
    console.warn('[Init] Failed to set 7-Zip permissions:', e);
  }
}

function getConsoleId(extension: string) {
  return EXTENSION_MAP[extension.toLowerCase()];
}

const list7z = (filePath: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    console.log(`[7z Raw] Listing: ${filePath}`);
    
    execFile(pathTo7zip, ['l', filePath, '-slt'], (error, stdout, stderr) => {
      if (error) {
        console.error('[7z Raw Error]', error);
        console.error('[7z Stderr]', stderr);
        return reject(error);
      }

      const entries: any[] = [];
      const blocks = stdout.split(/(\r\n|\r|\n){2}/);

      for (const block of blocks) {
        const lines = block.split(/(\r\n|\r|\n)/);
        const entry: any = {};
        
        for (const line of lines) {
          if (!line.includes('=')) continue;
          const [key, ...values] = line.split('=');
          if (key && values) {
            entry[key.trim()] = values.join('=').trim();
          }
        }

        if (entry.Path) {
          entries.push({
            file: entry.Path,
            attr: entry.Attributes,
            size: entry.Size
          });
        }
      }
      
      console.log(`[7z Raw] Found ${entries.length} entries.`);
      resolve(entries);
    });
  });
};

const extract7zFile = (archivePath: string, fileToExtract: string, outputDir: string): Promise<void> => {
  return new Promise((resolve, reject) => {

    const child = spawn(pathTo7zip, ['x', archivePath, `-o${outputDir}`, fileToExtract, '-y']);

    child.stdout.on('data', (data) => {
      const output = data.toString();
    });

    child.stderr.on('data', (data) => {
      console.error(`[7z stderr]: ${data.toString().trim()}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error(`[7z Raw] Process exited with code ${code}`);
        reject(new Error(`7-Zip exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error('[7z Raw] Spawn Error:', err);
      reject(err);
    });
  });
};

type ScanResult = 
  | { type: 'game'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'bios'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'unknown' };

export const validationController = {
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
        const entries = await list7z(filePath);
        
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
          
          const id = getConsoleId(path.extname(entry.file));
          if (id) {
             console.log(`[Scanner] Found Game Candidate: ${entry.file} (${id})`);
             return true;
          }
          return false;
        });

        if (validGameEntry) {
          return {
            type: 'game',
            consoleId: getConsoleId(path.extname(validGameEntry.file)),
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
          return getConsoleId(path.extname(entry.name)) !== undefined;
        });

        if (validGameEntry) {
          return {
            type: 'game',
            consoleId: getConsoleId(path.extname(validGameEntry.name)),
            filePath,
            zipEntryName: validGameEntry.entryName
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

    const destFilename = sourceName;
    const newFilePath = path.join(romsDir, destFilename);

    try {
      const ext = path.extname(scanResult.filePath).toLowerCase();

      // handle 7z
      if (ext === '.7z' && scanResult.zipEntryName) {
        const tempDir = path.join(app.getPath('temp'), 'rombox_extract_' + crypto.randomUUID());
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        await extract7zFile(scanResult.filePath, scanResult.zipEntryName, tempDir);

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
  }
};