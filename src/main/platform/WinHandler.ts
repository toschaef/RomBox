import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { homedir } from "os";
import type { PlatformHandler } from "./types";
import { Extractor } from "../utils/extractor";
import { Logger } from "../utils/logger";
import type { Platform, Game } from "../../shared/types";
import type { EngineID } from "../../shared/types/engines";
import {
  allBasePaths,
  resolveBasePath,
  resolveBiosPath,
  resolveConfigPath,
  resolveSavePath,
} from "../emulators/paths";
import type { PlatformRoots } from "../emulators/types";

const log = Logger.create("WinHandler");

export class WinHandler implements PlatformHandler {
  async extractArchive(filePath: string, destDir: string): Promise<void> {
    await Extractor.extractArchive(filePath, destDir);
  }

  async installDependency(
    filePath: string,
    targetDir: string,
    searchName: string,
    targetFilename: string
  ): Promise<void> {
    log.info(`Installing dependency: ${searchName} to ${targetFilename}`);
    const destPath = path.win32.join(targetDir, targetFilename);
    await fs.promises.copyFile(filePath, destPath);
  }

  async finalizeInstall(binaryPath: string, _needsWrapper: boolean): Promise<void> {
    if (!fs.existsSync(binaryPath)) return;
    log.info(`Finalizing: ${binaryPath}`);
  }

  private getBaseDirs() {
    const env = process.env;
    const home = env.USERPROFILE || env.HOME || homedir();
    const appData = env.APPDATA || path.win32.join(home, "AppData", "Roaming");
    const localAppData = env.LOCALAPPDATA || path.win32.join(home, "AppData", "Local");
    const docs = path.win32.join(home, "Documents");
    return { appData, localAppData, docs, home };
  }

  resolveWinPath(p: string): string {
    const { appData, localAppData, home } = this.getBaseDirs();
    return p
      .replace(/%APPDATA%/gi, appData)
      .replace(/%LOCALAPPDATA%/gi, localAppData)
      .replace(/%USERPROFILE%/gi, home);
  }

  async clearPlatformData(): Promise<void> {
    for (const dir of allBasePaths("win32", this.getRoots())) {
      if (fs.existsSync(dir)) {
        log.info(`Cleaning config: ${dir}`);
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    }
  }

  launchProcess(binaryPath: string, args: string[], opts?: { cwd?: string }): ChildProcess {
    log.info(`Launch: ${binaryPath}`);
    const cwd = opts?.cwd || path.win32.dirname(binaryPath);
    return spawn(binaryPath, args, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      cwd
    });
  }

  getRoots(): PlatformRoots {
    const { appData, localAppData, docs, home } = this.getBaseDirs();
    return {
      home,
      appSupport: appData,
      preferences: appData,
      localAppData,
      documents: docs,
    };
  }

  getEmulatorConfigPath(engineId: EngineID): string {
    return resolveConfigPath(engineId, "win32", this.getRoots());
  }

  getEmulatorBasePath(engineId: EngineID): string {
    return resolveBasePath(engineId, "win32", this.getRoots());
  }

  getSavePath(game: Game): string {
    return resolveSavePath(game, "win32", this.getRoots());
  }

  getBiosPath(engineId: EngineID): string | null {
    return resolveBiosPath(engineId, "win32", this.getRoots());
  }

  getPlatformId(): "windows" {
    return "windows";
  }

  getPlatform(): Platform {
    return "win32";
  }
}
