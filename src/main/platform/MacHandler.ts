import { execSync, exec, spawn, type ChildProcess } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { homedir } from "os";
import type { PlatformHandler } from "./types";
import { findFile } from "../utils/fsUtils";
import { Extractor } from "../utils/extractor";
import { Logger } from "../utils/logger";
import type { Platform, Game } from "../../shared/types";
import type { EngineID } from "../../shared/types/engines";

const log = Logger.create("MacHandler");

type FinalizeOptions = {
  resetMesenSupportDir?: boolean;
  verbose?: boolean;
};

const execAsync = promisify(exec);

export class MacHandler implements PlatformHandler {

  async extractArchive(filePath: string, destDir: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".dmg") {
      log.info(`DMG detected: ${path.basename(filePath)}`);
      await this.extractDmg(filePath, destDir);
      return;
    }

    await Extractor.extractArchive(filePath, destDir);
  }

  async installDependency(
    dmgPath: string,
    installDir: string,
    searchName: string,
    targetFilename: string
  ): Promise<void> {
    log.info(`Installing dependency: ${searchName} from ${path.basename(dmgPath)}`);

    const mountPoint = await this.mountDmgReadonly(dmgPath);
    try {
      const foundPath = findFile(mountPoint, searchName);
      if (!foundPath) throw new Error(`Could not find ${searchName} in DMG`);

      const macOsDir = findFile(installDir, "MacOS");
      const destDir = macOsDir || installDir;
      const destPath = path.join(destDir, targetFilename);

      if (fs.statSync(foundPath).isDirectory()) {
        const binaryInside = findFile(foundPath, searchName);
        if (!binaryInside) throw new Error("Found directory, but no binary inside framework");
        await fs.promises.copyFile(binaryInside, destPath);
      } else {
        await fs.promises.copyFile(foundPath, destPath);
      }

      await this.tryExecAsync(`install_name_tool -id "@executable_path/${targetFilename}" "${destPath}"`, true);

      await this.removeQuarantine(destPath);
      log.info(`Dependency installed: ${destPath}`);
    } finally {
      await this.unmountDmg(mountPoint);
    }
  }

  async finalizeInstall(binaryPath: string, needsWrapper: boolean, opts: FinalizeOptions = {}): Promise<void> {
    if (!fs.existsSync(binaryPath)) return;

    this.tryChmod(binaryPath);

    const appPath = this.getAppBundlePath(binaryPath);
    const isAppBundle = !!appPath;

    let targetBinary = binaryPath;
    if (isAppBundle) {
      log.info(`App bundle detected: ${appPath}`);
      targetBinary = this.resolveBundleBinary(binaryPath);
    }

    log.info(`Finalizing: ${targetBinary}`);

    await this.removeQuarantine(targetBinary);
    await this.adHocSign(targetBinary);

    if (isAppBundle || needsWrapper) {
      await this.ensureWrapper(targetBinary, opts.verbose);
    }

    if (isAppBundle) {
      if (!appPath) return;
      await this.deepSign(appPath);
    }
  }
  // rework this eventually
  async clearPlatformData(): Promise<void> {
    const home = homedir();
    const pathsToDelete = [
      path.join(home, ".config", "Mesen2"),
      path.join(home, "Library", "Application Support", "Mesen2"),
      path.join(home, "Library", "Application Support", "ares"),
      path.join(home, "Library", "Application Support", "Dolphin"),
      path.join(home, "Library", "Application Support", "azahar"),
      path.join(home, "Library", "Preferences", "melonDS"),
      path.join(home, "Library", "Application Support", "PCSX2"),
      path.join(home, "Library", "Application Support", "DuckStation"),
    ];

    for (const p of pathsToDelete) {
      if (fs.existsSync(p)) {
        log.info(`Cleaning config: ${p}`);
        await fs.promises.rm(p, { recursive: true, force: true });
      }
    }
  }

  launchProcess(binaryPath: string, args: string[]): ChildProcess {
    log.info(`Launch: ${binaryPath}`);

    const env = {
      ...process.env,
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
    };

    if (binaryPath.includes(".app")) {
      let executablePath = binaryPath;

      if (!fs.existsSync(binaryPath)) {
        const appPath = this.getAppBundlePath(binaryPath);
        if (!appPath) throw new Error(`Could not find app bundle in path: ${binaryPath}`);

        const bundleName = path.basename(appPath, ".app");
        executablePath = path.join(appPath, "Contents", "MacOS", bundleName);
      }

      log.info(`Launch app executable: ${executablePath}`);
      return spawn(executablePath, args, { detached: true, stdio: ["ignore", "pipe", "pipe"], env });
    }

    return spawn(binaryPath, args, { detached: true, stdio: ["ignore", "pipe", "pipe"], env });
  }

  getEmulatorConfigPath(engineId: EngineID): string {
    const home = homedir();

    switch (engineId) {
      case "dolphin":
        return path.join(home, "Library", "Application Support", "Dolphin", "Config");
      case "mesen":
        return path.join(home, "Library", "Application Support", "Mesen2");
      case "ares":
        return path.join(home, "Library", "Application Support", "ares");
      case "melonds":
        return path.join(home, "Library", "Preferences", "melonDS");
      case "azahar":
        return path.join(home, "Library", "Application Support", "Azahar", "config");
      case "pcsx2":
        return path.join(home, "Library", "Application Support", "PCSX2", "inis");
      case "duckstation":
        return path.join(home, "Library", "Application Support", "DuckStation");
      default:
        throw new Error(`[Mac] Emulator config path not found for: ${engineId}`);
    }
  }

  getEmulatorBasePath(engineId: EngineID): string {
    const home = homedir();

    switch (engineId) {
      case "dolphin":
        return path.join(home, "Library", "Application Support", "Dolphin");
      case "mesen":
        return path.join(home, "Library", "Application Support", "Mesen2");
      case "ares":
        return path.join(home, "Library", "Application Support", "ares");
      case "melonds":
        return path.join(home, "Library", "Preferences", "melonDS");
      case "azahar":
        return path.join(home, "Library", "Application Support", "Azahar");
      case "pcsx2":
        return path.join(home, "Library", "Application Support", "PCSX2");
      case "duckstation":
        return path.join(home, "Library", "Application Support", "DuckStation");
      default:
        throw new Error(`[Mac] Emulator base path not found for: ${engineId}`);
    }
  }

  getSavePath(game: Game) {
    const home = homedir();
    switch (game.engineId) {
      case "mesen":
        return path.join(home, "Library", "Application Support", "Mesen2", "Saves");
      case "melonds":
        return path.dirname(game.filePath);
      case "dolphin":
        if (game.consoleId === "wii") {
          return path.join(home, "Library", "Application Support", "Dolphin", "Wii");
        }
        return path.join(home, "Library", "Application Support", "Dolphin", "GC");
      case "azahar":
        return path.join(home, "Library", "Application Support", "Azahar", "sdmc");
      case "ares":
        return path.join(home, "Library", "Application Support", "ares", "Saves");
      case "rmg":
        return path.join(home, "Library", "Application Support", "RMG", "Save");
      case "duckstation":
        return path.join(home, "Library", "Application Support", "DuckStation", "memcards");
      case "pcsx2":
        return path.join(home, "Library", "Application Support", "PCSX2", "memcards");
      default:
        throw new Error(`[SaveService] Unknown engine: ${game.engineId}`);
    }
  }

  getPlatformId(): "macos" {
    return "macos";
  }

  getPlatform(): Platform {
    return "darwin";
  }

  // helpers

  private findAllAppBundles(dir: string): string[] {
    const results: string[] = [];
    try {
      for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        const stat = fs.lstatSync(fullPath);

        if (file.endsWith(".app")) {
          results.push(fullPath);
          continue;
        }

        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          results.push(...this.findAllAppBundles(fullPath));
        }
      }
    } catch (err) {
      void err;
    }
    return results;
  }

  private async extractDmg(filePath: string, destDir: string): Promise<void> {
    const mountPoint = path.join(path.dirname(filePath), `mount_${Date.now()}`);
    try {
      await this.tryExecAsync(`hdiutil attach -nobrowse -noautoopen -mountpoint "${mountPoint}" "${filePath}"`);
      const appBundles = this.findAllAppBundles(mountPoint);
      if (appBundles.length === 0) throw new Error("No .app bundle found inside DMG.");

      for (const appPath of appBundles) {
        log.info(`Copy app: ${path.basename(appPath)} -> ${destDir}`);
        await this.tryExecAsync(`cp -R "${appPath}" "${destDir}/"`);
      }
    } finally {
      if (fs.existsSync(mountPoint)) await this.unmountDmg(mountPoint);
    }
  }

  private async mountDmgReadonly(dmgPath: string): Promise<string> {
    const { stdout } = await execAsync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`);
    const mountOutput = stdout.toString();
    const mountPoint = mountOutput.match(/\/Volumes\/[^\n\r]*/)?.[0].trim() || "";
    if (!mountPoint) throw new Error("Could not mount DMG");
    return mountPoint;
  }

  private async unmountDmg(mountPoint: string): Promise<void> {
    await this.tryExecAsync(`hdiutil detach "${mountPoint}" -force`, true);
  }

  private getAppBundlePath(p: string): string | null {
    const match = p.match(/(.*\.app)/);
    return match ? match[1] : null;
  }

  private resolveBundleBinary(binaryPath: string): string {
    const appPath = this.getAppBundlePath(binaryPath) ?? binaryPath;
    const bundleName = path.basename(appPath, ".app");
    return path.join(appPath, "Contents", "MacOS", bundleName);
  }

  private async ensureWrapper(targetBinary: string, verbose?: boolean): Promise<void> {
    const binaryDir = path.dirname(targetBinary);
    const binaryName = path.basename(targetBinary);
    const realBinaryName = `${binaryName}.real`;
    const realBinaryPath = path.join(binaryDir, realBinaryName);

    if (fs.existsSync(realBinaryPath)) {
      if (verbose) log.info("Wrapper already present; skipping");
      return;
    }

    log.info(`Create wrapper for: ${binaryName}`);

    try {
      await fs.promises.rename(targetBinary, realBinaryPath);

      const scriptContent = [
        "#!/bin/bash",
        'DIR="$(cd "$(dirname "$0")" && pwd)"',
        'export DYLD_LIBRARY_PATH="$DIR:$DYLD_LIBRARY_PATH"',
        `exec "$DIR/${realBinaryName}" "$@"`,
      ].join("\n");

      await fs.promises.writeFile(targetBinary, scriptContent, "utf-8");
      this.tryChmod(targetBinary);
      this.tryChmod(realBinaryPath);

      await this.removeQuarantine(realBinaryPath);
      await this.adHocSign(realBinaryPath);

      log.info("Wrapper ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Wrapper failed: ${msg}`);
    }
  }

  private tryChmod(p: string): void {
    try {
      fs.chmodSync(p, "755");
    } catch (err) {
      void err;
    }
  }

  private tryExec(cmd: string, ignoreErrors = false): void {
    try {
      execSync(cmd, { stdio: "ignore" });
    } catch (err) {
      if (!ignoreErrors) throw err;
    }
  }

  private async tryExecAsync(cmd: string, ignoreErrors = false): Promise<void> {
    try {
      await execAsync(cmd);
    } catch (err) {
      if (!ignoreErrors) throw err;
    }
  }

  private async removeQuarantine(filePath: string): Promise<void> {
    try {
      await execAsync(`xattr -r -d com.apple.quarantine "${filePath}"`);
      log.info(`Unquarantine: ${path.basename(filePath)}`);
    } catch (err) {
      void err;
    }
  }

  private async adHocSign(filePath: string): Promise<void> {
    try {
      await this.tryExecAsync(`codesign --remove-signature "${filePath}"`, true);
      await execAsync(`codesign --force --sign - --preserve-metadata=entitlements "${filePath}"`);
    } catch (err) {
      void err;
    }
  }

  private async deepSign(appPath: string): Promise<void> {
    try {
      await execAsync(`codesign --force --deep --sign - "${appPath}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Deep sign failed: ${msg}`);
    }
  }
}