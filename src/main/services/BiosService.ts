import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { app } from "electron";
import { homedir } from "os";

import type { ConsoleID } from "../../shared/types";
import { CONSOLES } from "../config/consoles";
import { getEngineIdFromConsoleId } from "../../shared/constants";
import { BiosStatus } from "../../shared/types/bios";

const USERDATA = app.getPath("userData");

const BIOS_CACHE_PATH = path.join(USERDATA, "bios");

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

  ensureBiosInstalledFromCache(consoleId: ConsoleID): { copied: string[]; missing: string[] } {
    const c = CONSOLES[consoleId];
    if (!c?.bios) return { copied: [], missing: [] };

    const firmwareDir = getFirmwareDir(consoleId);
    const cacheDir = getCacheDir(consoleId);

    ensureDir(firmwareDir);
    ensureDir(cacheDir);

    const copied: string[] = [];
    const missing: string[] = [];

    for (const f of c.bios.files) {
      const dest = path.join(firmwareDir, f.filename);
      if (fs.existsSync(dest)) continue;

      const cached = path.join(cacheDir, f.filename);
      if (fs.existsSync(cached)) {
        fs.copyFileSync(cached, dest);
        copied.push(f.filename);
      } else {
        missing.push(f.filename);
      }
    }

    return { copied, missing };
  },

  async installBios(consoleId: ConsoleID, sourcePath: string) {
    const c = CONSOLES[consoleId];
    if (!c?.bios) throw new Error("This console does not require a BIOS.");

    const firmwareDir = getFirmwareDir(consoleId);
    const cacheDir = getCacheDir(consoleId);

    ensureDir(firmwareDir);
    ensureDir(cacheDir);

    const targetDirs = [firmwareDir, cacheDir];

    const installedFiles: string[] = [];
    const isZip = path.extname(sourcePath).toLowerCase() === ".zip";

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
    const c = CONSOLES[consoleId];
    if (!c?.bios) throw new Error("This console does not require a BIOS.");

    const allowed = c.bios.files.some((f) => f.filename.toLowerCase() === fileName.toLowerCase());
    if (!allowed) throw new Error(`'${fileName}' is not a known BIOS file for ${consoleId}.`);

    const firmwareDir = getFirmwareDir(consoleId);
    const cacheDir = getCacheDir(consoleId);

    const targets = [path.join(firmwareDir, fileName), path.join(cacheDir, fileName)];

    let deleted = 0;
    for (const p of targets) {
      if (fs.existsSync(p)) {
        fs.rmSync(p, { force: true });
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