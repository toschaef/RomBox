import path from 'path';
import crypto from "crypto";
import fs from 'fs';
import { app } from 'electron';
import { Extractor } from '../utils/extractor';
import { CONSOLES } from '../config/consoles'
import { getConsoleIdFromExtension, getEngineIdFromConsoleId, BIOS_FILENAMES } from '../../shared/emulators/derived';
import type { Game, ConsoleID } from '../../shared/types';
import type { EngineID } from '../../shared/types/engines';
import { detectConsoleFromHeader, detectConsoleFromBuffer, detectPS1orPS2FromISO9660, detectPS1orPS2FromBuffer, parseCueSectorGeometry, parseCueSectorGeometryFromFile, PLAIN_ISO_GEOMETRY } from '../utils/identifier';
import { scanZipEntries, readZipEntryHeader } from '../utils/fsUtils';
import { BiosService } from './BiosService';
import { romsRoot } from './library/gamePaths';
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
  for (const [fn, consoleId] of Object.entries(BIOS_FILENAMES)) {
    out[fn.toLowerCase()] = consoleId;
  }
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

// PCSX2 has been observed to fail opening otherwise-valid .cue sheets
// ("Unable to identify the ISO image type") while opening the referenced
// .bin/.iso directly works fine. PS2 discs never have multiple audio tracks
// (unlike PS1), so when a cue/bin pair resolves to exactly one data file,
// hand the emulator that file directly instead of the .cue to sidestep it.
function resolveDiscEntrypoint(dir: string, cueFilePath: string, consoleId: ConsoleID): string {
  if (consoleId !== 'ps2') return cueFilePath;

  const dataFiles = fs.readdirSync(dir).filter(f => {
    const lower = f.toLowerCase();
    return lower.endsWith('.bin') || lower.endsWith('.iso');
  });

  return dataFiles.length === 1 ? path.join(dir, dataFiles[0]) : cueFilePath;
}

async function identifyCueBinConsole(dirPath: string, cueFile: string): Promise<'ps1' | 'ps2'> {
  try {
    const binFile = fs.readdirSync(dirPath).find(f => f.toLowerCase().endsWith('.bin'));
    if (binFile) {
      const geometry = await parseCueSectorGeometryFromFile(path.join(dirPath, cueFile));
      const detected = await detectPS1orPS2FromISO9660(path.join(dirPath, binFile), geometry);
      if (detected) return detected;
    }
  } catch (err) {
    void err;
  }
  return 'ps1';
}

const identifyConsole = async (
  filename: string,
  fileSize: number,
  filePathForHeader?: string,
  headerBuffer?: Buffer
): Promise<string | undefined> => {
  const ext = path.extname(filename).toLowerCase();
  const id = getConsoleIdFromExtension(ext);

  if (headerBuffer) {
    const detected = detectConsoleFromBuffer(headerBuffer);
    if (detected) return detected;
  }

  if (filePathForHeader && (ext === '.iso' || !id)) {
    const detected = await detectConsoleFromHeader(filePathForHeader);
    if (detected) return detected;
  } else if (!filePathForHeader && headerBuffer && (ext === '.iso' || ext === '.bin')) {
    // No file path to open directly (e.g. a zip entry) - fall back to walking
    // the in-memory buffer for the SYSTEM.CNF BOOT/BOOT2 marker instead of
    // just guessing from file size below.
    const detected = await detectPS1orPS2FromBuffer(headerBuffer, PLAIN_ISO_GEOMETRY);
    if (detected) return detected;
  }

  if (ext === '.rvz') {
    const WII_THRESHOLD = 1.5 * 1024 * 1024 * 1024;
    if (fileSize > WII_THRESHOLD) return 'wii';
    return 'gc';
  }

  if (!id && (ext === '.bin' || ext === '.iso' || ext === '.img' || ext === '.chd')) {
    if (fileSize > 800 * 1024 * 1024) return 'ps2';
    if (fileSize > 50 * 1024 * 1024) return 'ps1';
  }

  return id ?? undefined;
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

const identifyMultiFileGame = async (
  entries: NormalizedEntry[],
  archivePath: string,
  archiveExt: string
): Promise<ConsoleID | undefined> => {
  const binEntries = entries.filter(e => e.name.toLowerCase().endsWith('.bin'));
  if (binEntries.length === 0) return undefined;

  if (archiveExt === '.zip') {
    const cueEntry = entries.find(e => e.name.toLowerCase().endsWith('.cue'));
    if (cueEntry) {
      try {
        const cueBuffer = await readZipEntryHeader(archivePath, cueEntry.name);
        const geometry = parseCueSectorGeometry(cueBuffer.toString('utf-8'));
        const binBuffer = await readZipEntryHeader(archivePath, binEntries[0].name, 300 * 1024);
        const detected = await detectPS1orPS2FromBuffer(binBuffer, geometry);
        if (detected) return detected;
      } catch (err) {
        void err;
      }
    }
  }

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
          const consoleId = await identifyCueBinConsole(inputPath, ps1Check.cueFile);
          return [{
            type: "game",
            consoleId,
            engineId: getEngineIdFromConsoleId(consoleId),
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.warn('Error accessing path', { path: inputPath, error: errorMsg });
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
          const consoleId = await identifyMultiFileGame(entries, filePath, ext) as ConsoleID;
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
          const normEntryPath = entry.name.replace(/\\/g, "/");
          const entryName = path.basename(normEntryPath).toLowerCase();
          const entryExt = path.extname(normEntryPath).toLowerCase();

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
            } catch (nestedErr) {
              const errorMsg = nestedErr instanceof Error ? nestedErr.message : String(nestedErr);
              log.warn('Failed to process nested archive', { entry: entry.name, error: errorMsg });
            }
            continue;
          }

          if (entryExt === '.bin' && cueEntry) {
            continue;
          }

          {
            let headerBuffer: Buffer | undefined;
            if (['.bin', '.iso', '.img', '.chd'].includes(entryExt) && ext === '.zip') {
              try {
                // Read enough of the entry to cover the ISO9660 PVD (sector 16),
                // root directory, and SYSTEM.CNF contents, not just the first 33KB.
                headerBuffer = await readZipEntryHeader(filePath, entry.name, 300 * 1024);
              } catch (hErr) {
                void hErr;
              }
            }

            const consoleId = await identifyConsole(entry.name, entry.size, undefined, headerBuffer) as ConsoleID;

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
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.warn('Failed to inspect archive', { ext, error: errorMsg });
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.warn('Error checking raw file', { error: errorMsg });
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

    const romsDir = path.join(romsRoot(), scanResult.consoleId);

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

        const entrypoint = resolveDiscEntrypoint(path.dirname(cueFilePath), cueFilePath, scanResult.consoleId);

        log.info('Extracted multi-file game', { destDir, cueFilePath, entrypoint });

        return {
          id: crypto.randomUUID(),
          title,
          filePath: entrypoint,
          consoleId: scanResult.consoleId,
          engineId: getEngineIdFromConsoleId(scanResult.consoleId),
        };
      } catch (err) {
        log.error('Failed to import multi-file game', err);
        throw new Error("Could not import multi-file game from archive.");
      }
    }

    const isDirectory = fs.existsSync(scanResult.filePath) && fs.statSync(scanResult.filePath).isDirectory();
    if (isDirectory) {
      const cueFile = fs.readdirSync(scanResult.filePath).find(f => f.toLowerCase().endsWith('.cue'));
      if (!cueFile) {
        throw new Error('Could not find .cue file in game directory');
      }

      const entrypoint = resolveDiscEntrypoint(
        scanResult.filePath,
        path.join(scanResult.filePath, cueFile),
        scanResult.consoleId
      );

      log.info('Referencing game directory in place', { entrypoint });

      return {
        id: crypto.randomUUID(),
        title,
        filePath: entrypoint,
        consoleId: scanResult.consoleId,
        engineId: getEngineIdFromConsoleId(scanResult.consoleId),
      };
    }

    // a loose file is left where the user keeps it - only archive entries have
    // to be extracted, because no emulator can be handed a path inside a .zip
    if (!scanResult.zipEntryName) {
      log.info('Referencing game file in place', { filePath: scanResult.filePath });
      return {
        id: crypto.randomUUID(),
        title,
        filePath: scanResult.filePath,
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
    } catch (err) {
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