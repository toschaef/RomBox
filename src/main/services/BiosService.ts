import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { app } from "electron";
import { homedir } from "os";

import type { ConsoleID, Game } from "../../shared/types";
import { CONSOLES } from "../config/consoles";
import type { BiosFile, BiosStatus } from "../../shared/types/bios";
import { getDirectoryBios, type DirectoryBios } from "../emulators";
import {
  computeBiosStatus,
  directoryBiosStatus,
  noBiosStatus,
} from "./bios/biosStatus";
import { getRequiredSnesFirmware } from "../utils/mesen/snesFirmware";
import { Logger } from "../utils/logger";

const log = Logger.create('BiosService');

const USERDATA = app.getPath("userData");

const BIOS_CACHE_PATH = path.join(USERDATA, "bios");

function mergeDirNoOverwrite(src: string, dest: string) {
  ensureDir(dest);

  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === ".DS_Store") continue;

    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);

    if (ent.isDirectory()) {
      mergeDirNoOverwrite(s, d);
    } else {
      if (!fs.existsSync(d)) {
        ensureDir(path.dirname(d));
        fs.copyFileSync(s, d);
      }
    }
  }
}

function defaultFirmwareDirFallback() {
  return path.join(homedir(), ".config", "Mesen2", "Firmware");
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getFirmwareDir(consoleId: ConsoleID): string {
  const c = CONSOLES[consoleId];
  return c?.bios?.installDir || defaultFirmwareDirFallback();
}

function getCacheDir(consoleId: ConsoleID): string {
  return path.join(BIOS_CACHE_PATH, consoleId);
}

function biosDirs(consoleId: ConsoleID) {
  return { firmwareDir: getFirmwareDir(consoleId), cacheDir: getCacheDir(consoleId) };
}

/** Files without an explicit level are required; game-specific ones are not. */
function isRequired(file: BiosFile): boolean {
  return (file.level ?? "required") === "required" && !file.gameSpecific;
}

/** Copies whole system-data directories out of the cache. */
function restoreDirectories(dirs: string[], firmwareDir: string, cacheDir: string) {
  const copied: string[] = [];
  const missing: string[] = [];

  for (const name of dirs) {
    const dest = path.join(firmwareDir, name);
    if (fs.existsSync(dest)) continue;

    const cached = path.join(cacheDir, name);
    if (!fs.existsSync(cached)) {
      missing.push(name);
      continue;
    }

    try {
      fs.cpSync(cached, dest, { recursive: true, force: true });
      copied.push(name);
    } catch (err) {
      missing.push(name);
      log.warn("Failed to restore system directory from cache", { name, error: (err as Error)?.message });
    }
  }

  return { copied, missing };
}

/** Merges a user-selected system-data folder into each target directory. */
function installDirectories(layout: DirectoryBios, sourcePath: string, targets: string[]): string[] {
  if (!fs.statSync(sourcePath).isDirectory()) throw new Error(layout.selectionHint);
  if (path.basename(sourcePath).toLowerCase() !== layout.sourceFolderName) {
    throw new Error(layout.selectionHint);
  }

  const installed: string[] = [];
  for (const name of layout.dirs) {
    const src = path.join(sourcePath, name);
    if (!fs.existsSync(src)) continue;

    for (const target of targets) mergeDirNoOverwrite(src, path.join(target, name));
    installed.push(name);
  }

  if (installed.length === 0) throw new Error(layout.incompleteMessage);
  return installed;
}

export const BiosService = {
  getConsoleBiosStatus(consoleId: ConsoleID): BiosStatus {
    const dirs = biosDirs(consoleId);

    const directory = getDirectoryBios(consoleId);
    if (directory) return directoryBiosStatus(consoleId, directory, dirs);

    const bios = CONSOLES[consoleId]?.bios;
    if (!bios) return noBiosStatus(consoleId, dirs);

    const files = bios.files ?? [];
    return computeBiosStatus({
      consoleId,
      files,
      required: bios.required ?? true,
      onlyNeedOne: bios.onlyNeedOne ?? false,
      requiredFiles: files.filter(isRequired),
      warningFiles: files.filter((f) => !isRequired(f)),
      ...dirs,
    });
  },

  getGameBiosStatus(game: Game): BiosStatus {
    const { consoleId } = game;
    const dirs = biosDirs(consoleId);

    const directory = getDirectoryBios(consoleId);
    if (directory) return directoryBiosStatus(consoleId, directory, dirs);

    const bios = CONSOLES[consoleId]?.bios;
    if (!bios) return noBiosStatus(consoleId, dirs);

    const files = bios.files ?? [];
    const required = bios.required ?? true;
    const onlyNeedOne = bios.onlyNeedOne ?? false;

    if (consoleId === "snes") {
      const needed = getRequiredSnesFirmware(game.filePath);
      if (needed.length === 0) {
        return {
          ...noBiosStatus(consoleId, dirs),
          cachedFiles: files
            .filter((f) => fs.existsSync(path.join(dirs.cacheDir, f.filename)))
            .map((f) => f.filename),
          required,
          onlyNeedOne,
        };
      }

      const neededSet = new Set(needed.map((n) => n.toLowerCase()));
      return computeBiosStatus({
        consoleId,
        files,
        required,
        onlyNeedOne,
        requiredFiles: files.filter((f) => neededSet.has(f.filename.toLowerCase())),
        warningFiles: [],
        forceRequired: true,
        ...dirs,
      });
    }

    return computeBiosStatus({
      consoleId,
      files,
      required,
      onlyNeedOne,
      requiredFiles: files.filter(isRequired),
      warningFiles: files.filter((f) => !isRequired(f)),
      ...dirs,
    });
  },

  ensureBiosInstalledFromCache(consoleId: ConsoleID): { copied: string[]; missing: string[] } {
    log.debug('Ensuring BIOS installed from cache', { consoleId });
    const c = CONSOLES[consoleId];
    if (!c?.bios) return { copied: [], missing: [] };

    const firmwareDir = getFirmwareDir(consoleId);
    const cacheDir = getCacheDir(consoleId);

    ensureDir(firmwareDir);
    ensureDir(cacheDir);

    const copied: string[] = [];
    const missing: string[] = [];

    const directory = getDirectoryBios(consoleId);
    if (directory) {
      return restoreDirectories(directory.dirs, firmwareDir, cacheDir);
    }

    for (const f of c.bios.files) {
      const dest = path.join(firmwareDir, f.filename);

      if (fs.existsSync(dest)) continue;

      const cached = path.join(cacheDir, f.filename);
      if (!fs.existsSync(cached)) {
        missing.push(f.filename);
        continue;
      }

      const st = fs.statSync(cached);

      try {
        if (st.isDirectory()) {
          ensureDir(path.dirname(dest));
          fs.cpSync(cached, dest, { recursive: true, force: true });
        } else {
          ensureDir(path.dirname(dest));
          fs.copyFileSync(cached, dest);
        }
        copied.push(f.filename);
      } catch (err) {
        missing.push(f.filename);
        log.warn('Failed to restore BIOS from cache', { filename: f.filename, err });
      }
    }

    return { copied, missing };
  },

  async installBios(consoleId: ConsoleID, sourcePath: string) {
    log.info('Installing BIOS', { consoleId, sourcePath });
    const c = CONSOLES[consoleId];
    if (!c?.bios) throw new Error("This console does not require a BIOS.");

    const firmwareDir = getFirmwareDir(consoleId);
    const cacheDir = getCacheDir(consoleId);

    ensureDir(firmwareDir);
    ensureDir(cacheDir);

    const targetDirs = [firmwareDir, cacheDir];

    const installedFiles: string[] = [];
    const isZip = path.extname(sourcePath).toLowerCase() === ".zip";

    const directory = getDirectoryBios(consoleId);
    if (directory) {
      const installed = installDirectories(directory, sourcePath, [firmwareDir, cacheDir]);
      const status = BiosService.getConsoleBiosStatus(consoleId);
      return { success: true, consoleId, installed, biosState: status.biosState };
    }

    if (isZip) {
      const zip = new AdmZip(sourcePath);
      const zipEntries = zip.getEntries();

      for (const biosFile of c.bios.files) {
        const entry = zipEntries.find((e) =>
          path.basename(e.name).toLowerCase() === biosFile.filename.toLowerCase()
        );
        if (!entry) continue;

        for (const dir of targetDirs) {
          fs.writeFileSync(path.join(dir, biosFile.filename), entry.getData());
        }
        installedFiles.push(biosFile.filename);
      }
    } else {
      const sourceFilename = path.basename(sourcePath).toLowerCase();
      const matched = c.bios.files.find((f) => f.filename.toLowerCase() === sourceFilename);
      if (!matched) {
        throw new Error(`File '${path.basename(sourcePath)}' is not a valid BIOS for ${consoleId}`);
      }

      for (const dir of targetDirs) {
        fs.copyFileSync(sourcePath, path.join(dir, matched.filename));
      }
      installedFiles.push(matched.filename);
    }

    if (installedFiles.length === 0) {
      throw new Error("No valid BIOS files found in selection.");
    }

    const status = BiosService.getConsoleBiosStatus(consoleId);

    log.info('BIOS installation complete', { consoleId, installedFiles, biosState: status.biosState });

    return {
      success: true,
      consoleId,
      installed: installedFiles,
      biosState: status.biosState,
      missingRequiredFiles: status.missingRequiredFiles,
      missingWarningFiles: status.missingWarningFiles,
    };
  },

  async deleteBios(consoleId: ConsoleID, fileName: string) {
    log.info('Deleting BIOS file', { consoleId, fileName });
    const c = CONSOLES[consoleId];
    if (!c?.bios) throw new Error("This console does not require a BIOS.");

    const allowed = c.bios.files.some((f) => f.filename.toLowerCase() === fileName.toLowerCase());
    if (!allowed) {
      log.warn('Attempted to delete unknown BIOS file', { consoleId, fileName });
      throw new Error(`'${fileName}' is not a known BIOS file for ${consoleId}.`);
    }

    const firmwareDir = getFirmwareDir(consoleId);
    const cacheDir = getCacheDir(consoleId);

    const targets = [path.join(firmwareDir, fileName), path.join(cacheDir, fileName)];
    let deleted = 0;

    for (const p of targets) {
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        deleted++;
      }
    }

    const status = BiosService.getConsoleBiosStatus(consoleId);

    return {
      success: true,
      consoleId,
      fileName,
      deleted,
      biosState: status.biosState,
      missingRequiredFiles: status.missingRequiredFiles,
      missingWarningFiles: status.missingWarningFiles,
    };
  },

  getAllBiosStatus(): BiosStatus[] {
    const out: BiosStatus[] = [];
    for (const consoleId of Object.keys(CONSOLES) as ConsoleID[]) {
      const c = CONSOLES[consoleId];
      if (!c?.bios) continue;
      out.push(BiosService.getConsoleBiosStatus(consoleId));
    }
    return out;
  },
};