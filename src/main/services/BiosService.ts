import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { app } from "electron";
import { homedir } from "os";

import type { ConsoleID, Game } from "../../shared/types";
import { CONSOLES } from "../config/consoles";
import { getEngineIdFromConsoleId } from "../../shared/constants";
import { BiosStatus } from "../../shared/types/bios";
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

export const BiosService = {
  getConsoleBiosStatus(consoleId: ConsoleID): BiosStatus {
    const c = CONSOLES[consoleId];
    const engineId = getEngineIdFromConsoleId(consoleId);

    const firmwareDir = getFirmwareDir(consoleId);
    const cacheDir = getCacheDir(consoleId);

    if (consoleId === "3ds") {
      const want = ["nand", "sysdata", "sdmc"];
      const missing = want.filter(n => !fs.existsSync(path.join(firmwareDir, n)));

      return {
        consoleId, engineId,
        needsBios: true,
        biosState: missing.length ? "warning" : "ok",
        missingRequiredFiles: [],
        missingWarningFiles: missing,
        cachedFiles: want.filter(n => fs.existsSync(path.join(cacheDir, n))),
        cachedComplete: true,
        cacheMissingFiles: [],
        required: false,
        firmwareDir,
        cacheDir,
      };
    }

    if (!c?.bios) {
      return {
        consoleId,
        engineId,
        needsBios: false,

        biosState: "none",
        missingRequiredFiles: [],
        missingWarningFiles: [],

        cachedFiles: [],
        cachedComplete: true,
        cacheMissingFiles: [],
        required: false,

        firmwareDir,
        cacheDir,
      };
    }

    const required = c.bios.required ?? true;

    const files = c.bios.files ?? [];

    const reqFiles = files.filter((f) => (f.level ?? "required") === "required" && !f.gameSpecific);
    const warnFiles = files.filter((f) => (f.level ?? "required") === "warning" || !!f.gameSpecific);

    const effectiveReqFiles = required ? reqFiles : [];
    const effectiveWarnFiles = required ? warnFiles : files;

    const missingRequiredFiles = effectiveReqFiles
      .filter((f) => !fs.existsSync(path.join(firmwareDir, f.filename)))
      .map((f) => f.filename);

    const missingWarningFiles = effectiveWarnFiles
      .filter((f) => !fs.existsSync(path.join(firmwareDir, f.filename)))
      .map((f) => f.filename);

    const cacheMissingFiles = effectiveReqFiles
      .filter((f) => !fs.existsSync(path.join(cacheDir, f.filename)))
      .map((f) => f.filename);

    const cachedFiles = files
      .filter((f) => fs.existsSync(path.join(cacheDir, f.filename)))
      .map((f) => f.filename);

    let biosState: "ok" | "warning" | "missing" | "none" = "ok";
    if (!files.length) biosState = "none";
    else if (missingRequiredFiles.length > 0) biosState = "missing";
    else if (missingWarningFiles.length > 0) biosState = "warning";
    else biosState = "ok";

    return {
      consoleId,
      engineId,
      needsBios: true,

      biosState,
      missingRequiredFiles,
      missingWarningFiles,

      cachedFiles,
      cachedComplete: cacheMissingFiles.length === 0,
      cacheMissingFiles,
      required,

      firmwareDir,
      cacheDir,
    };
  },

  getGameBiosStatus(game: Game): BiosStatus {
    const { consoleId } = game;
    const c = CONSOLES[consoleId];
    const engineId = getEngineIdFromConsoleId(consoleId);

    const firmwareDir = getFirmwareDir(consoleId);
    const cacheDir = getCacheDir(consoleId);

    if (consoleId === "3ds") {
      const want = ["nand", "sysdata", "sdmc"];
      const missing = want.filter(n => !fs.existsSync(path.join(firmwareDir, n)));

      return {
        consoleId, engineId,
        needsBios: true,
        biosState: missing.length ? "warning" : "ok",
        missingRequiredFiles: [],
        missingWarningFiles: missing,
        cachedFiles: want.filter(n => fs.existsSync(path.join(cacheDir, n))),
        cachedComplete: true,
        cacheMissingFiles: [],
        required: false,
        firmwareDir,
        cacheDir,
      };
    }

    if (!c?.bios) {
      return {
        consoleId, engineId,
        needsBios: false,
        biosState: "none",
        missingRequiredFiles: [],
        missingWarningFiles: [],
        cachedFiles: [],
        cachedComplete: true,
        cacheMissingFiles: [],
        required: false,
        firmwareDir, cacheDir,
      };
    }

    const required = c.bios.required ?? true;
    const files = c.bios.files ?? [];

    // Default behavior:
    let reqFiles = files.filter((f) => (f.level ?? "required") === "required" && !f.gameSpecific);
    let warnFiles = files.filter((f) => (f.level ?? "required") === "warning" || !!f.gameSpecific);
    let forceRequiredForThisGame = false;

    // SNES override: only check chip firmware needed by THIS ROM, and treat it as required
    if (consoleId === "snes") {
      const needed = getRequiredSnesFirmware(game.filePath);
      const neededSet = new Set(needed.map((x) => x.toLowerCase()));

      reqFiles = files.filter((f) => neededSet.has(f.filename.toLowerCase()));
      warnFiles = [];

      if (needed.length === 0) {
        return {
          consoleId, engineId,
          needsBios: false,
          biosState: "none",
          missingRequiredFiles: [],
          missingWarningFiles: [],
          cachedFiles: files
            .filter((f) => fs.existsSync(path.join(cacheDir, f.filename)))
            .map((f) => f.filename),
          cachedComplete: true,
          cacheMissingFiles: [],
          required,
          firmwareDir, cacheDir,
        };
      }

      forceRequiredForThisGame = true;
    }

    const effectiveReqFiles = forceRequiredForThisGame ? reqFiles : (required ? reqFiles : []);
    const effectiveWarnFiles = forceRequiredForThisGame ? warnFiles : (required ? warnFiles : files);

    const missingRequiredFiles = effectiveReqFiles
      .filter((f) => !fs.existsSync(path.join(firmwareDir, f.filename)))
      .map((f) => f.filename);

    const missingWarningFiles = effectiveWarnFiles
      .filter((f) => !fs.existsSync(path.join(firmwareDir, f.filename)))
      .map((f) => f.filename);

    const cacheMissingFiles = effectiveReqFiles
      .filter((f) => !fs.existsSync(path.join(cacheDir, f.filename)))
      .map((f) => f.filename);

    const cachedFiles = files
      .filter((f) => fs.existsSync(path.join(cacheDir, f.filename)))
      .map((f) => f.filename);

    let biosState: "ok" | "warning" | "missing" | "none" = "ok";
    if (!files.length) biosState = "none";
    else if (missingRequiredFiles.length > 0) biosState = "missing";
    else if (missingWarningFiles.length > 0) biosState = "warning";
    else biosState = "ok";

    return {
      consoleId, engineId,
      needsBios: forceRequiredForThisGame? true : effectiveReqFiles.length > 0? true : false,
      biosState,
      missingRequiredFiles,
      missingWarningFiles,
      cachedFiles,
      cachedComplete: cacheMissingFiles.length === 0,
      cacheMissingFiles,
      required,
      firmwareDir, cacheDir,
    };
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

    if (consoleId === "3ds") {
      const firmwareDir = getFirmwareDir(consoleId);
      const cacheDir = getCacheDir(consoleId);

      ensureDir(firmwareDir);
      ensureDir(cacheDir);

      const want = ["nand", "sysdata", "sdmc"];
      const copied: string[] = [];
      const missing: string[] = [];

      for (const name of want) {
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
          log.warn('Failed to restore 3ds BIOS from cache', { name, error: err.message ?? err });
        }
      }

      return { copied, missing };
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

    if (consoleId === "3ds") {
      const stat = fs.statSync(sourcePath);
      if (!stat.isDirectory()) throw new Error("Select the Azahar 'user' folder.");

      if (path.basename(sourcePath).toLowerCase() !== "user") {
        throw new Error("Select the Azahar 'user' folder (must be named 'user').");
      }

      const roots = ["nand", "sysdata", "sdmc"];
      const installed: string[] = [];

      for (const name of roots) {
        const src = path.join(sourcePath, name);
        if (!fs.existsSync(src)) continue;

        const destA = path.join(firmwareDir, name);
        const destC = path.join(cacheDir, name);

        mergeDirNoOverwrite(src, destA);
        mergeDirNoOverwrite(src, destC);

        installed.push(name);
      }

      if (installed.length === 0) throw new Error("Invalid user folder (missing nand/sysdata/sdmc).");

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

    const target = path.join(c.bios.installDir, fileName);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });

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