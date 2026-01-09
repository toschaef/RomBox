import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { homedir } from 'os';
import { ENGINES } from '../config/engines';
import { osHandler } from '../platform';
import { Platform, EngineConfig, EngineInfo, EngineStatus, EmulatorID, ConsoleID } from '../../shared/types';
import { Downloader } from '../utils/downloader';
import { getConsoleIdFromEmulatorId } from '../../shared/constants';

const BASE_PATH = path.join(app.getPath('userData'), 'engines');

// move this logic eventually
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

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  console.warn("[EngineService] native helper not found. Tried:\n" + candidates.join("\n"));
  return null;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function tryChmod755(p: string) {
  try {
    fs.chmodSync(p, 0o755);
  } catch {}
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
  getEnginePath: async (consoleId: string) => {
    const config = ENGINES[consoleId];
    if (!config) return null;
    
    const platform = process.platform as Platform;
    const binaryConfigPath = config.binaries[platform];
    const dirName = config.installDir || consoleId;
    const installBase = path.join(BASE_PATH, dirName);
    
    try {
      return await osHandler.resolveBinaryPath(installBase, binaryConfigPath);
    } catch (err) {
      return null;
    }
  },

  getEngines: async (): Promise<EngineInfo[]> => {
    const platform = process.platform as Platform;
    const entries = Object.entries(ENGINES) as Array<[string, EngineConfig]>;

    const infos = await Promise.all(
      entries.map(async ([consoleId, cfg]): Promise<EngineInfo> => {
        const dirName = cfg.installDir || consoleId;
        const installDirAbs = path.join(BASE_PATH, dirName);
        const installExists = fs.existsSync(installDirAbs);

        const supported = !!cfg.downloads?.[platform] && !!cfg.binaries?.[platform];

        const needsBios = !!cfg.bios;
        let biosInstalled = true;
        let biosMissingFiles: string[] = [];

        if (needsBios) {
          biosInstalled = EngineService.isBiosInstalled(consoleId);
          const firmwareDir =
            cfg.bios!.installDir || path.join(homedir(), ".config", "Mesen2", "Firmware");
          biosMissingFiles = cfg.bios!.files
            .filter((f) => !fs.existsSync(path.join(firmwareDir, f.filename)))
            .map((f) => f.filename);
        }

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

        const dto = {
          id: cfg.id,
          name: cfg.name,
          acceptedExtensions: cfg.acceptedExtensions,
          installDir: cfg.installDir,
          bios: cfg.bios,
          downloads: cfg.downloads,
          binaries: cfg.binaries,
          dependencies: cfg.dependencies,
        };

        return {
          ...dto,
          consoleId,

          status,
          platform,
          installDir: installDirAbs,
          installExists,

          resolvedBinaryPath,

          needsBios,
          biosInstalled,
          biosMissingFiles,

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
      return a.consoleId.localeCompare(b.consoleId);
    });

    return infos;
  },

  deleteEngine: (consoleId: ConsoleID) => {
    try {
      osHandler.deleteEngine(consoleId);
      return { success: true };
    } catch (err) {
      console.log('[EngineService] Error deleting engine', err.message);
      return { success: false, err: err.message }
    }
  },

  installEngine: async (emulatorId: EmulatorID, onProgress: (s: string) => void) => {
    const consoleId = getConsoleIdFromEmulatorId(emulatorId);
    const config = ENGINES[consoleId];
    if (!config) throw new Error("Invalid Engine");

    const platform = process.platform as Platform;
    const url = config.downloads[platform];
    
    const installDir = path.join(BASE_PATH, config.installDir || consoleId);
    
    if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true });
    fs.mkdirSync(installDir, { recursive: true });

    try {
      onProgress('Downloading');
      const configWithHeaders = config as EngineConfig & { headers?: Record<string, string> };
      const customHeaders = configWithHeaders.headers || {};

      const downloadedFilePath = await Downloader.download(url, installDir, {
        onProgress,
        headers: customHeaders
      });

      onProgress('Extracting');
      const stats = fs.statSync(downloadedFilePath);
      if (stats.size < 1024 * 1024) throw new Error("Downloaded file is too small (invalid).");

      await osHandler.extractArchive(downloadedFilePath, installDir);
      fs.unlinkSync(downloadedFilePath);

      // handle nested archives
      const files = fs.readdirSync(installDir);
      // filter system files
      const validFiles = files.filter(f => !f.startsWith('.')); 
      
      const nestedArchive = validFiles.find(f => 
        ['.zip', '.7z', '.rar', '.tar', '.gz'].includes(path.extname(f).toLowerCase())
      );

      if (nestedArchive) {
         console.log(`[EngineService] Found nested archive: ${nestedArchive}`);
         const nestedPath = path.join(installDir, nestedArchive);
         
         await osHandler.extractArchive(nestedPath, installDir);
         
         fs.unlinkSync(nestedPath);
      }

      // install dependencies
      if (config.dependencies) {
        for (const dep of config.dependencies) {
           if (dep.platform !== platform) continue;
           
           onProgress(`Installing dependency: ${dep.sourceName || dep.filename}...`);
           
           const depPath = await Downloader.download(dep.url, installDir);

           await osHandler.installDependency(
             depPath, 
             installDir, 
             dep.sourceName || dep.filename,
             dep.filename
           );
           
           fs.unlinkSync(depPath);
        }
      }

      // finalize
      const binaryConfigPath = config.binaries[platform];
      const resolvedBinary = await osHandler.resolveBinaryPath(installDir, binaryConfigPath);
      
      const needsWrapper = config.dependencies && config.dependencies.length > 0;
      
      await osHandler.finalizeInstall(resolvedBinary, !!needsWrapper);

      if (consoleId === '3ds') {
        const r = installAzaharSdlProbe();
        if (r.ok) {
          console.log("[EngineService][azahar] sdlprobe installed:", r.dest);
        } else {
          console.warn("[EngineService][azahar] sdlprobe not installed:", r.reason);
        }
      }

      return { success: true };
    } catch (err) {
      console.error("Install Failed:", err.message);
      return { success: false, message: err.message };
    }
  },

  isBiosInstalled: (consoleId: string): boolean => {
    const config = ENGINES[consoleId];
    if (!config?.bios) return true;

    const firmwareDir = config.bios.installDir || 
      path.join(homedir(), '.config', 'Mesen2', 'Firmware');

    return config.bios.files.every(file => 
      fs.existsSync(path.join(firmwareDir, file.filename))
    );
  },
  installBios: (consoleId: string, sourcePath: string) => {
    const config = ENGINES[consoleId];
    if (!config?.bios) throw new Error("This console does not require a BIOS.");

    const targetDirs = config.bios.installDir 
      ? [config.bios.installDir] 
      : [
          path.join(homedir(), '.config', 'Mesen2', 'Firmware'),
          path.join(homedir(), 'Library', 'Application Support', 'Mesen2', 'Firmware')
        ];

    const installedFiles: string[] = [];

    for (const dir of targetDirs) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    try {
      const isZip = path.extname(sourcePath).toLowerCase() === '.zip';

      if (isZip) {
        const zip = new AdmZip(sourcePath);
        const zipEntries = zip.getEntries();

        for (const biosFile of config.bios.files) {
          const entry = zipEntries.find(e => 
            e.name.toLowerCase() === biosFile.filename.toLowerCase()
          );

          if (entry) {
            for (const dir of targetDirs) {
              fs.writeFileSync(path.join(dir, biosFile.filename), entry.getData());
            }
            installedFiles.push(biosFile.filename);
          }
        }
      } else {
        const sourceFilename = path.basename(sourcePath).toLowerCase();
        const matchedConfig = config.bios.files.find(f => 
          f.filename.toLowerCase() === sourceFilename
        );

        if (matchedConfig) {
          for (const dir of targetDirs) {
            fs.copyFileSync(sourcePath, path.join(dir, matchedConfig.filename));
          }
          installedFiles.push(matchedConfig.filename);
        } else {
          throw new Error(`File '${path.basename(sourcePath)}' is not a valid BIOS for ${consoleId}`);
        }
      }

      if (installedFiles.length === 0) {
        throw new Error("No valid BIOS files found in selection.");
      }
      return { success: true, installed: installedFiles };

    } catch (err) {
      console.error(`[BIOS] Installation failed:`, err.message);
      throw err;
    }
  },
  clearEngines: () => {
    try {
      console.log("Clearing all engines and BIOS files...");
      if (fs.existsSync(BASE_PATH)) {
        fs.rmSync(BASE_PATH, { recursive: true, force: true });
        fs.mkdirSync(BASE_PATH);
      }
      
      osHandler.clearPlatformData();
      
      return { success: true };
    } catch (err) { 
      console.error("Failed to clear engines:", err);
      throw err; 
    }
  },
};