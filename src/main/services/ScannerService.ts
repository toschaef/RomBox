import path from 'path';
import crypto from "crypto";
import fs from 'fs';
import { app } from 'electron';
import { Extractor } from '../utils/extractor';
import { CONSOLES } from '../config/consoles'
import { getConsoleIdFromExtension } from '../../shared/constants';
import type { Game, ConsoleID } from '../../shared/types';
import type { EngineID } from '../../shared/types/engines';
import { detectConsoleFromHeader } from '../utils/identifier';
import { scanZipEntries } from '../utils/fsUtils';
import { getEngineIdFromConsoleId } from '../../shared/constants';
import { BiosService } from './BiosService';
import { Logger } from '../utils/logger';
import AdmZip from 'adm-zip';

const log = Logger.create('ScannerService');

export type ScanResult =
  | { type: 'game'; consoleId: ConsoleID; engineId: EngineID; filePath: string; zipEntryName?: string; isMultiFile?: boolean }
  | { type: 'bios'; consoleId: ConsoleID; engineId: EngineID; filePath: string; zipEntryName?: string };

interface NormalizedEntry {
  name: string;
  size: number;
}

const BIOS_NAME_TO_CONSOLE: Record<string, ConsoleID> = (() => {
  const out: Record<string, ConsoleID> = {};
  for (const consoleId of Object.keys(CONSOLES) as ConsoleID[]) {
    const bios = CONSOLES[consoleId].bios;
    if (!bios) continue;
    for (const f of bios.files) {
      out[f.filename.toLowerCase()] = consoleId;
    }
  }
  return out;
})();

function isAzaharUserRoot(p: string): boolean {
  return (
    path.basename(p).toLowerCase() === "user" &&
    fs.statSync(p).isDirectory() &&
    (
      fs.existsSync(path.join(p, "nand")) ||
      fs.existsSync(path.join(p, "sysdata")) ||
      fs.existsSync(path.join(p, "sdmc"))
    )
  );
}

function findAzaharUserRootFromDir(inputPath: string): string | null {
  if (isAzaharUserRoot(inputPath)) return inputPath;

  const base = path.basename(inputPath).toLowerCase();
  if (base === "user" && isAzaharUserRoot(inputPath)) return inputPath;

  const candidate = path.join(inputPath, "user");
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() && isAzaharUserRoot(candidate)) {
    return candidate;
  }

  return null;
}

function isPS1GameDirectory(dirPath: string): { found: boolean; cueFile?: string } {
  try {
    const files = fs.readdirSync(dirPath);
    const cueFile = files.find(f => f.toLowerCase().endsWith('.cue'));

    if (cueFile) {
      return { found: true, cueFile };
    }
  } catch (err) {
    void err;
  }
  return { found: false };
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

const identifyMultiFileGame = async (entries: NormalizedEntry[]): Promise<ConsoleID | undefined> => {
  const binEntries = entries.filter(e => e.name.toLowerCase().endsWith('.bin'));
  if (binEntries.length === 0) return undefined;

  const totalBinSize = binEntries.reduce((sum, e) => sum + e.size, 0);

  const PS2_THRESHOLD = 800 * 1024 * 1024;

  if (totalBinSize > PS2_THRESHOLD) {
    return 'ps2';
  }
  return 'ps1';
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

        const userRoot = findAzaharUserRootFromDir(inputPath);
        if (userRoot) {
          return [{
            type: "bios",
            consoleId: "3ds",
            engineId: getEngineIdFromConsoleId("3ds"),
            filePath: userRoot,
          }];
        }

        if (isAzaharUserRoot(inputPath)) {
          return [{
            type: "bios",
            consoleId: "3ds",
            engineId: getEngineIdFromConsoleId("3ds"),
            filePath: inputPath,
          }];
        }

        const ps1Check = isPS1GameDirectory(inputPath);
        if (ps1Check.found && ps1Check.cueFile) {
          return [{
            type: "game",
            consoleId: "ps1",
            engineId: getEngineIdFromConsoleId("ps1"),
            filePath: inputPath,
          }];
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
    } catch (err: any) {
      log.warn('Error accessing path', { path: inputPath, error: err?.message ?? err });
      return [];
    }
  },

  scanFile: async (filePath: string): Promise<ScanResult[]> => {
    log.debug('Scanning file', { filePath });
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);
    const results: ScanResult[] = [];

    const hit = BIOS_NAME_TO_CONSOLE[filename.toLowerCase()];
    if (hit) {
      const engineId = getEngineIdFromConsoleId(hit);
      return [{ type: "bios", consoleId: hit, engineId, filePath }];
    }


    if (['.zip', '.7z'].includes(ext)) {
      try {
        const entries = await getArchiveEntries(filePath);
        const names = entries.map(e => e.name.replace(/\\/g, "/").toLowerCase());

        const hasUserRoot =
          names.some(n => n.startsWith("user/nand")) ||
          names.some(n => n.startsWith("user/sysdata")) ||
          names.some(n => n.startsWith("user/sdmc"));

        if (hasUserRoot) {
          return [{
            type: "bios",
            consoleId: "3ds",
            engineId: getEngineIdFromConsoleId("3ds"),
            filePath,
            zipEntryName: "user",
          }];
        }

        const cueEntry = entries.find(e => e.name.toLowerCase().endsWith('.cue'));
        const binEntries = entries.filter(e => e.name.toLowerCase().endsWith('.bin'));

        if (cueEntry && binEntries.length > 0) {
          log.info('Detected multi-file game (cue/bin) in archive', { cueEntry: cueEntry.name });
          const consoleId = await identifyMultiFileGame(entries) as ConsoleID;
          if (consoleId) {
            const engineId = getEngineIdFromConsoleId(consoleId);
            return [{
              type: 'game',
              consoleId,
              engineId,
              filePath,
              zipEntryName: cueEntry.name,
              isMultiFile: true,
            }];
          }
        }

        for (const entry of entries) {
          const entryName = path.basename(entry.name).toLowerCase();
          const entryExt = path.extname(entry.name).toLowerCase();
          const hit = BIOS_NAME_TO_CONSOLE[entryName];
          if (hit) {
            const engineId = getEngineIdFromConsoleId(hit);
            results.push({
              type: "bios",
              consoleId: hit,
              engineId,
              filePath,
              zipEntryName: entry.name,
            });
            continue;
          }

          if (['.zip', '.7z'].includes(entryExt)) {
            log.debug('Found nested archive', { entry: entry.name });

            const tempNestedZip = path.join(app.getPath('temp'), `rombox_nested_${Date.now()}_${path.basename(entry.name)}`);

            try {
              await Extractor.extractToFile(filePath, tempNestedZip, entry.name);

              const nestedResults = await ScannerService.scanFile(tempNestedZip);
              results.push(...nestedResults);
            } catch (nestedErr: any) {
              log.warn('Failed to process nested archive', { entry: entry.name, error: nestedErr?.message });
            }
            continue;
          }

          if (entryExt === '.bin' && cueEntry) {
            continue;
          }

          {
            const consoleId = await identifyConsole(entry.name, entry.size) as ConsoleID;

            if (consoleId) {
              const engineId = getEngineIdFromConsoleId(consoleId);
              results.push({
                type: 'game',
                consoleId,
                engineId,
                filePath,
                zipEntryName: entry.name
              });
            }
          }
        }

        return results;
      } catch (err: any) {
        log.warn('Failed to inspect archive', { ext, error: err?.message });
        return [];
      }
    }

    try {
      const stats = fs.statSync(filePath);
      const consoleId = await identifyConsole(filename, stats.size, filePath) as ConsoleID;
      if (consoleId) {
        const engineId = getEngineIdFromConsoleId(consoleId)
        return [{ type: 'game', consoleId, engineId, filePath }];
      }
    } catch (err: any) {
      log.warn('Error checking raw file', { error: err?.message });
    }

    return [];
  },

  importGame: async (scanResult: ScanResult & { type: 'game' }): Promise<Game> => {
    log.info('Importing game', { consoleId: scanResult.consoleId, filePath: scanResult.filePath });
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

    if (scanResult.isMultiFile && scanResult.zipEntryName) {
      log.info('Importing multi-file game from archive');
      const archiveBasename = path.basename(scanResult.filePath, path.extname(scanResult.filePath));
      let destDir = path.join(romsDir, archiveBasename);

      if (fs.existsSync(destDir)) {
        destDir = path.join(romsDir, `${archiveBasename}_${Date.now()}`);
      }

      try {
        fs.mkdirSync(destDir, { recursive: true });

        const ext = path.extname(scanResult.filePath).toLowerCase();
        if (ext === '.7z') {
          await Extractor.extract7z(scanResult.filePath, destDir);
        } else {
          const zip = new AdmZip(scanResult.filePath);
          zip.extractAllTo(destDir, true);
        }

        const findCueFile = (dir: string): string | null => {
          const files = fs.readdirSync(dir, { withFileTypes: true });
          for (const f of files) {
            const fullPath = path.join(dir, f.name);
            if (f.isDirectory()) {
              const found = findCueFile(fullPath);
              if (found) return found;
            } else if (f.name.toLowerCase().endsWith('.cue')) {
              return fullPath;
            }
          }
          return null;
        };

        const cueFilePath = findCueFile(destDir);
        if (!cueFilePath) {
          throw new Error('Could not find .cue file in extracted archive');
        }

        log.info('Extracted multi-file game', { destDir, cueFilePath });

        return {
          id: crypto.randomUUID(),
          title,
          filePath: cueFilePath,
          consoleId: scanResult.consoleId,
          engineId: getEngineIdFromConsoleId(scanResult.consoleId),
        };
      } catch (err: any) {
        log.error('Failed to import multi-file game', err);
        throw new Error("Could not import multi-file game from archive.");
      }
    }

    const isDirectory = fs.existsSync(scanResult.filePath) && fs.statSync(scanResult.filePath).isDirectory();
    if ((scanResult.consoleId === 'ps1' || scanResult.consoleId === 'ps2') && isDirectory) {
      const dirName = path.basename(scanResult.filePath);
      let destDir = path.join(romsDir, dirName);

      if (fs.existsSync(destDir)) {
        destDir = path.join(romsDir, `${dirName}_${Date.now()}`);
      }

      try {
        fs.mkdirSync(destDir, { recursive: true });

        const files = fs.readdirSync(scanResult.filePath);
        for (const file of files) {
          const srcFile = path.join(scanResult.filePath, file);
          const destFile = path.join(destDir, file);

          if (fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, destFile);
          }
        }

        log.info('Copied game directory', { destDir });
      } catch (err: any) {
        log.error('Failed to copy game directory', err);
        throw new Error("Could not import game directory.");
      }

      return {
        id: crypto.randomUUID(),
        title,
        filePath: destDir,
        consoleId: scanResult.consoleId,
        engineId: getEngineIdFromConsoleId(scanResult.consoleId),
      };
    }

    let destFilename = sourceName;
    let newFilePath = path.join(romsDir, destFilename);

    if (fs.existsSync(newFilePath)) {
      const nameParts = path.parse(sourceName);
      destFilename = `${nameParts.name}_${Date.now()}${nameParts.ext}`;
      newFilePath = path.join(romsDir, destFilename);
    }

    try {
      await Extractor.extractToFile(scanResult.filePath, newFilePath, scanResult.zipEntryName);
    } catch (err: any) {
      log.error('Failed to import ROM', err);
      throw new Error("Could not import file into library.");
    }

    return {
      id: crypto.randomUUID(),
      title,
      filePath: newFilePath,
      consoleId: scanResult.consoleId,
      engineId: getEngineIdFromConsoleId(scanResult.consoleId),
    };
  },
  async importBios(scanResult: ScanResult & { type: "bios" }) {
    if (!scanResult.zipEntryName) {
      return BiosService.installBios(scanResult.consoleId, scanResult.filePath);
    }

    if (scanResult.consoleId === "3ds") {
      const tempRoot = path.join(app.getPath("temp"), `rombox_azahar_${Date.now()}`);
      fs.mkdirSync(tempRoot, { recursive: true });

      try {
        const ext = path.extname(scanResult.filePath).toLowerCase();
        if (ext === ".7z") {
          await Extractor.extract7z(scanResult.filePath, tempRoot);
        } else {
          const zip = new AdmZip(scanResult.filePath);
          zip.extractAllTo(tempRoot, true);
        }

        const entry = (scanResult.zipEntryName ?? "").trim();
        const candidate = entry ? path.join(tempRoot, entry) : tempRoot;

        const userDir = fs.existsSync(path.join(candidate, "user"))
          ? path.join(candidate, "user")
          : candidate;

        return await BiosService.installBios("3ds", userDir);
      } finally {
        try {
          fs.rmSync(tempRoot, {
            recursive: true,
            force: true
          });
        } catch (err) {
          void err;
        }
      }
    }

    const tempDir = path.join(app.getPath("temp"), "rombox_bios");
    fs.mkdirSync(tempDir, { recursive: true });

    const tempPath = path.join(
      tempDir,
      `bios_${scanResult.consoleId}_${Date.now()}_${path.basename(scanResult.zipEntryName)}`
    );

    await Extractor.extractToFile(scanResult.filePath, tempPath, scanResult.zipEntryName);

    try {
      return await BiosService.installBios(scanResult.consoleId, tempPath);
    } finally {
      try {
        fs.rmSync(tempPath, { recursive: true, force: true });
      } catch (err) {
        void err;
      }
    }
  },
};