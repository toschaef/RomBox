import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { homedir } from "os";
import type { PlatformHandler } from "./types";
import { Extractor } from "../utils/extractor";
import { Logger } from "../utils/logger";
import type { Platform, Game } from "../../shared/types";
import type { EngineID } from "../../shared/types/engines";

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
    const destPath = path.join(targetDir, targetFilename);
    await fs.promises.copyFile(filePath, destPath);
  }

  async finalizeInstall(binaryPath: string, needsWrapper: boolean): Promise<void> {
    if (!fs.existsSync(binaryPath)) return;
    log.info(`Finalizing: ${binaryPath}`);
  }

  private getBaseDirs() {
    const home = homedir();
    const appData = path.join(home, "AppData", "Roaming");
    const localAppData = path.join(home, "AppData", "Local");
    const docs = path.join(home, "Documents");
    return { appData, localAppData, docs };
  }

  async clearPlatformData(): Promise<void> {
    const { appData, localAppData, docs } = this.getBaseDirs();

    const pathsToDelete = [
      path.join(appData, "Mesen2"), // possibly docs
      path.join(localAppData, "ares"),
      path.join(appData, "Dolphin Emulator"),
      path.join(docs, "Dolphin Emulator"),
      path.join(appData, "Azahar"),
      path.join(localAppData, "melonDS"),
      path.join(docs, "PCSX2"),
      path.join(docs, "DuckStation"),
    ];

    for (const p of pathsToDelete) {
      if (fs.existsSync(p)) {
        log.info(`Cleaning config: ${p}`);
        await fs.promises.rm(p, { recursive: true, force: true });
      }
    }
  }

  launchProcess(binaryPath: string, args: string[], opts?: { cwd?: string }): ChildProcess {
    log.info(`Launch: ${binaryPath}`);
    return spawn(binaryPath, args, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: opts?.cwd || path.dirname(binaryPath)
    });
  }

  getEmulatorConfigPath(engineId: EngineID): string {
    const { appData, localAppData, docs } = this.getBaseDirs();

    switch (engineId) {
      case "dolphin":
        return path.join(appData, "Dolphin Emulator", "Config");
      case "mesen":
        return path.join(appData, "Mesen2");
      case "ares":
        return path.join(localAppData, "ares");
      case "melonds":
        return path.join(localAppData, "melonDS");
      case "azahar":
        return path.join(appData, "Azahar", "config");
      case "pcsx2":
        return path.join(docs, "PCSX2", "inis");
      case "duckstation":
        return path.join(docs, "DuckStation");
      default:
        throw new Error(`[Win] Emulator config path not found for: ${engineId}`);
    }
  }

  getEmulatorBasePath(engineId: EngineID): string {
    const { appData, localAppData, docs } = this.getBaseDirs();

    switch (engineId) {
      case "dolphin":
        return path.join(appData, "Dolphin Emulator");
      case "mesen":
        return path.join(appData, "Mesen2");
      case "ares":
        return path.join(localAppData, "ares");
      case "melonds":
        return path.join(localAppData, "melonDS");
      case "azahar":
        return path.join(appData, "Azahar");
      case "pcsx2":
        return path.join(docs, "PCSX2");
      case "duckstation":
        return path.join(docs, "DuckStation");
      default:
        throw new Error(`[Win] Emulator base path not found for: ${engineId}`);
    }
  }

  getSavePath(game: Game): string {
    const { appData, localAppData, docs } = this.getBaseDirs();

    switch (game.engineId) {
      case "mesen":
        return path.join(appData, "Mesen2", "Saves");
      case "melonds":
        return path.dirname(game.filePath);
      case "dolphin":
        if (game.consoleId === "wii") {
          return path.join(appData, "Dolphin Emulator", "Wii");
        }
        return path.join(appData, "Dolphin Emulator", "GC");
      case "azahar":
        return path.join(appData, "Azahar", "sdmc");
      case "ares":
        return path.join(localAppData, "ares", "Saves");
      case "rmg":
        return path.join(localAppData, "RMG", "Save"); // RMG is generally portable but maybe it uses AppData if not
      case "duckstation":
        return path.join(docs, "DuckStation", "memcards");
      case "pcsx2":
        return path.join(docs, "PCSX2", "memcards");
      default:
        throw new Error(`[SaveService] Unknown engine: ${game.engineId}`);
    }
  }

  getPlatformId(): "windows" {
    return "windows";
  }

  getPlatform(): Platform {
    return "win32";
  }
}
