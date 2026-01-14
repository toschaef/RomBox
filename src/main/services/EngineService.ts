import fs from "fs";
import path from "path";
import { app } from "electron";

import type { Platform, ConsoleID } from "../../shared/types";
import type { EngineID, EngineInfo, EngineStatus } from "../../shared/types/engines";

import { osHandler } from "../platform";
import { Downloader } from "../utils/downloader";
import { Logger } from "../utils/logger";
import { BiosService } from "./BiosService";
import { ENGINES } from "../config/engines";

const log = Logger.create('EngineService');

const USERDATA = app.getPath("userData");
const ENGINES_PATH = path.join(USERDATA, "engines");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function tryChmod755(p: string) {
  try {
    fs.chmodSync(p, 0o755);
  } catch {}
}

function resolveNativeHelperPath(helperName: string): string | null {
  if (app.isPackaged) {
    const p = path.join(process.resourcesPath, "native", helperName);
    return fs.existsSync(p) ? p : null;
  }

  const candidates = [
    path.resolve(app.getAppPath(), "src", "native", helperName),
    path.resolve(process.cwd(), "src", "native", helperName),
    path.resolve(process.cwd(), "..", "src", "native", helperName),
    path.resolve(process.cwd(), "..", "..", "src", "native", helperName),
  ];

  for (const p of candidates) if (fs.existsSync(p)) return p;
  log.warn('Native helper not found', { helperName, candidates });
  return null;
}

function installAzaharSdlProbe(): { ok: boolean; dest?: string; reason?: string } {
  const srcName = process.platform === "darwin" ? "sdlprobe-macos" : "sdlprobe";
  const src = resolveNativeHelperPath(srcName);
  if (!src) return { ok: false, reason: `native helper missing: ${srcName}` };

  const azConfigDir = osHandler.getEmulatorConfigPath("azahar");
  ensureDir(azConfigDir);

  const dest = path.join(azConfigDir, "rombox-azahar-sdlprobe");
  try {
    fs.copyFileSync(src, dest);
    tryChmod755(dest);
    return { ok: true, dest };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

function dirSizeBytes(p: string): number {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (st.isFile()) return st.size;

  let total = 0;
  for (const name of fs.readdirSync(p)) {
    if (name.startsWith(".")) continue;
    total += dirSizeBytes(path.join(p, name));
  }
  return total;
}

function dirMtimeMs(p: string): number | null {
  if (!fs.existsSync(p)) return null;
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

export const EngineService = {
  getEnginePath: async (engineId: EngineID) => {
    const cfg = ENGINES[engineId];
    if (!cfg) return null;

    const platform = process.platform as Platform;
    const binaryConfigPath = cfg.binaries[platform];
    if (!binaryConfigPath) return null;

    const installDirAbs = path.join(ENGINES_PATH, engineId);

    try {
      const resolvedPath = await osHandler.resolveBinaryPath(installDirAbs, binaryConfigPath);
      log.debug('Engine path resolved', { engineId, resolvedPath });
      return resolvedPath;
    } catch {
      return null;
    }
  },

  getEngines: async (): Promise<EngineInfo[]> => {
    const platform = process.platform as Platform;

    const entries = Object.entries(ENGINES) as Array<[EngineID, (typeof ENGINES)[EngineID]]>;

    const infos = await Promise.all(
      entries.map(async ([engineId, cfg]): Promise<EngineInfo> => {
        const installDirAbs = path.join(ENGINES_PATH, engineId);
        const installExists = fs.existsSync(installDirAbs);

        const supported = !!cfg.downloads?.[platform] && !!cfg.binaries?.[platform];

        let resolvedBinaryPath: string | null = null;
        let status: EngineStatus = "not_installed";
        let lastError: string | undefined;

        if (!supported) {
          status = "unsupported";
        } else if (!installExists) {
          status = "not_installed";
        } else {
          try {
            const binaryConfigPath = cfg.binaries[platform]!;
            resolvedBinaryPath = await osHandler.resolveBinaryPath(installDirAbs, binaryConfigPath);
            status = resolvedBinaryPath ? "installed" : "broken";
          } catch (err) {
            status = "broken";
            lastError = (err as Error).message;
            resolvedBinaryPath = null;
          }
        }

        let needsBios = false;
        let anyMissingRequired = false;
        let anyMissingWarning = false;

        const missingRequired: Array<{ consoleId: ConsoleID; filename: string }> = [];
        const missingWarning: Array<{ consoleId: ConsoleID; filename: string }> = [];

        for (const consoleId of cfg.consoles) {
          const st = BiosService.getConsoleBiosStatus(consoleId);
          if (!st.needsBios) continue;

          needsBios = true;

          for (const f of st.missingRequiredFiles) {
            anyMissingRequired = true;
            missingRequired.push({ consoleId, filename: f });
          }
          for (const f of st.missingWarningFiles) {
            anyMissingWarning = true;
            missingWarning.push({ consoleId, filename: f });
          }
        }

        const biosState =
          !needsBios ? "none" :
          anyMissingRequired ? "missing" :
          anyMissingWarning ? "warning" :
          "ok";

        const dto = {
          engineId: cfg.engineId,
          name: cfg.name,
          downloads: cfg.downloads,
          binaries: cfg.binaries,
          dependencies: cfg.dependencies,
          consoles: cfg.consoles,
        };

        return {
          ...dto,
          platform,

          status,
          installDirAbs,
          installExists,
          resolvedBinaryPath,

          needsBios,
          biosState,
          biosMissingRequired: missingRequired,
          biosMissingWarning: missingWarning,

          installSizeBytes: installExists ? dirSizeBytes(installDirAbs) : 0,
          installMtimeMs: installExists ? dirMtimeMs(installDirAbs) : null,

          ...(lastError ? { lastError } : {}),
        };
      })
    );

    const rank: Record<EngineStatus, number> = {
      installed: 0,
      broken: 1,
      not_installed: 2,
      unsupported: 3,
    };

    infos.sort((a, b) => {
      const ra = rank[a.status];
      const rb = rank[b.status];
      if (ra !== rb) return ra - rb;
      return a.engineId.localeCompare(b.engineId);
    });

    return infos;
  },

  deleteEngine: (engineId: EngineID) => {
    log.info('Deleting engine', { engineId });
    try {
      const cfg = ENGINES[engineId];
      if (!cfg) {
        log.warn('Invalid engineId for deletion', { engineId });
        return { success: false, err: "Invalid engineId" };
      }
      const rombox = path.join(app.getPath("userData"), 'engines', engineId);
      const engine = osHandler.getEmulatorBasePath(engineId);

      fs.rmSync(engine, { recursive: true, force: true });
      fs.rmSync(rombox, { recursive: true, force: true });

      log.info('Engine deleted successfully', { engineId });
      return { success: true };
    } catch (err) {
      log.error('Failed to delete engine', err);
      return { success: false, err: (err as Error).message };
    }
  },

  installEngine: async (engineId: EngineID, onProgress: (s: string) => void) => {
    const installLog = log.child({ engineId });
    installLog.info('Starting engine installation');
    
    const cfg = ENGINES[engineId];
    if (!cfg) throw new Error("Invalid Engine");

    const platform = process.platform as Platform;
    const url = cfg.downloads[platform];
    if (!url) throw new Error(`Engine not supported on ${platform}`);

    const installDirAbs = path.join(ENGINES_PATH, engineId);
    installLog.info('Installation directory', { installDirAbs });

    if (fs.existsSync(installDirAbs)) fs.rmSync(installDirAbs, { recursive: true, force: true });
    fs.mkdirSync(installDirAbs, { recursive: true });

    try {
      installLog.info('Downloading engine', { url });
      onProgress("Downloading");
      const downloadedFilePath = await Downloader.download(url, installDirAbs, { onProgress });

      installLog.info('Extracting archive');
      onProgress("Extracting");
      const stats = fs.statSync(downloadedFilePath);
      if (stats.size < 1024 * 1024) throw new Error("Downloaded file is too small (invalid).");

      await osHandler.extractArchive(downloadedFilePath, installDirAbs);
      fs.unlinkSync(downloadedFilePath);

      const files = fs.readdirSync(installDirAbs).filter((f) => !f.startsWith("."));
      const nestedArchive = files.find((f) =>
        [".zip", ".7z", ".rar", ".tar", ".gz"].includes(path.extname(f).toLowerCase())
      );

      if (nestedArchive) {
        installLog.info('Extracting nested archive', { nestedArchive });
        const nestedPath = path.join(installDirAbs, nestedArchive);
        await osHandler.extractArchive(nestedPath, installDirAbs);
        fs.unlinkSync(nestedPath);
      }

      // install dependencies
      if (cfg.dependencies) {
        for (const dep of cfg.dependencies) {
          if (dep.platform !== platform) continue;

          onProgress(`Installing dependency: ${dep.sourceName || dep.filename}...`);
          const depPath = await Downloader.download(dep.url, installDirAbs);
          await osHandler.installDependency(depPath, installDirAbs, dep.sourceName || dep.filename, dep.filename);
          fs.unlinkSync(depPath);
        }
      }

      // install bios from cache
      installLog.info('Checking BIOS cache for consoles', { consoles: cfg.consoles });
      for (const cid of cfg.consoles) {
        const status = BiosService.getConsoleBiosStatus(cid);
        if (!status.needsBios) continue;

        const r = BiosService.ensureBiosInstalledFromCache(cid);

        if (r.copied.length) installLog.info('BIOS restored from cache', { consoleId: cid, files: r.copied });
        if (r.missing.length) installLog.warn('BIOS files missing', { consoleId: cid, files: r.missing });
      }

      // finalize
      const binaryConfigPath = cfg.binaries[platform]!;
      const resolvedBinary = await osHandler.resolveBinaryPath(installDirAbs, binaryConfigPath);

      const needsWrapper = !!cfg.dependencies?.length;
      await osHandler.finalizeInstall(resolvedBinary, needsWrapper);

      if (engineId === "azahar") {
        const r = installAzaharSdlProbe();
        if (!r.ok) installLog.warn('SDL probe not installed', { reason: r.reason });

        try {
          BiosService.ensureBiosInstalledFromCache("3ds");
        } catch (err: any) {
          installLog.warn('Azahar cache restore failed', err);
        }
      }

      installLog.info('Engine installation complete');

      return { success: true };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  },

  clearEngines: () => {
    log.info('Clearing all engines');
    try {
      if (fs.existsSync(ENGINES_PATH)) {
        fs.rmSync(ENGINES_PATH, { recursive: true, force: true });
        fs.mkdirSync(ENGINES_PATH);
      }
      osHandler.clearPlatformData();
      log.info('All engines cleared successfully');
      return { success: true };
    } catch (err) {
      log.error('Failed to clear engines', err);
      throw err;
    }
  },
};