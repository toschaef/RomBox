import { execSync, spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { homedir } from "os";
import type { PlatformHandler } from "./types";
import { findFile } from "../utils/fsUtils";
import { Extractor } from "../utils/extractor";
import { Platform } from "../../shared/types";

type FinalizeOptions = {
  resetMesenSupportDir?: boolean;
  verbose?: boolean;
};

export class MacHandler implements PlatformHandler {

  async extractArchive(filePath: string, destDir: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".dmg") {
      console.log(`[Mac] DMG detected: ${path.basename(filePath)}`);
      await this.extractDmg(filePath, destDir);
      return;
    }

    if (ext === ".zip") {
      console.log(`[Mac] ZIP extract: ${path.basename(filePath)} -> ${destDir}`);
      const zip = new AdmZip(filePath);
      zip.extractAllTo(destDir, true);
      return;
    }

    if ([".7z", ".tar", ".gz", ".rar"].includes(ext)) {
      console.log(`[Mac] 7z extract: ${path.basename(filePath)} -> ${destDir}`);
      await Extractor.extract7z(filePath, destDir);
      return;
    }

    throw new Error(`Unsupported archive format for macOS: ${ext}`);
  }

  async installDependency(
    dmgPath: string,
    installDir: string,
    searchName: string,
    targetFilename: string
  ): Promise<void> {
    console.log(`[Mac] Installing dependency: ${searchName} from ${path.basename(dmgPath)}`);

    const mountPoint = this.mountDmgReadonly(dmgPath);
    try {
      const foundPath = findFile(mountPoint, searchName);
      if (!foundPath) throw new Error(`Could not find ${searchName} in DMG`);

      const macOsDir = findFile(installDir, "MacOS");
      const destDir = macOsDir || installDir;
      const destPath = path.join(destDir, targetFilename);

      if (fs.statSync(foundPath).isDirectory()) {
        const binaryInside = findFile(foundPath, searchName);
        if (!binaryInside) throw new Error("Found directory, but no binary inside framework");
        fs.copyFileSync(binaryInside, destPath);
      } else {
        fs.copyFileSync(foundPath, destPath);
      }

      this.tryExec(`install_name_tool -id "@executable_path/${targetFilename}" "${destPath}"`, true);

      await this.removeQuarantine(destPath);
      console.log(`[Mac] Dependency installed: ${destPath}`);
    } finally {
      this.unmountDmg(mountPoint);
    }
  }

  async finalizeInstall(binaryPath: string, needsWrapper: boolean, opts: FinalizeOptions = {}): Promise<void> {
    if (!fs.existsSync(binaryPath)) return;

    this.tryChmod(binaryPath);

    const appPath = this.getAppBundlePath(binaryPath);
    const isAppBundle = !!appPath;

    let targetBinary = binaryPath;
    if (isAppBundle) {
      console.log(`[Mac] App bundle detected: ${appPath}`);
      targetBinary = this.resolveBundleBinary(binaryPath);
    }

    console.log(`[Mac] Finalizing: ${targetBinary}`);

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

  async resolveBinaryPath(installDir: string, binaryConfigPath: string): Promise<string> {
    const strictPath = path.join(installDir, binaryConfigPath);
    if (fs.existsSync(strictPath)) return strictPath;

    const binaryName = path.basename(binaryConfigPath);
    const found = findFile(installDir, binaryName);
    if (!found) throw new Error(`Binary ${binaryName} not found in ${installDir}`);
    return found;
  }

  // rework this for prod, but good for dev
  clearPlatformData(): void {
    const home = homedir();
    const pathsToDelete = [
      path.join(home, ".config", "Mesen2"),
      path.join(home, "Library", "Application Support", "Mesen2"),
      path.join(home, "Library", "Application Support", "Dolphin"),
      path.join(home, "Library", "Preferences", "melonDS"),
      path.join(home, "Library", "Preferences", "azahar"),
    ];

    for (const p of pathsToDelete) {
      if (fs.existsSync(p)) {
        console.log(`[Mac] Cleaning config: ${p}`);
        fs.rmSync(p, { recursive: true, force: true });
      }
    }
  }

  launchProcess(binaryPath: string, args: string[]): ChildProcess {
    console.log(`[Mac] Launch: ${binaryPath}`);

    if (binaryPath.includes(".app")) {
      const appPath = this.getAppBundlePath(binaryPath);
      if (!appPath) throw new Error(`Could not find app bundle in path: ${binaryPath}`);

      const bundleName = path.basename(appPath, ".app");
      const wrapperPath = path.join(appPath, "Contents", "MacOS", bundleName);

      if (this.isWrapperScript(wrapperPath)) {
        console.log(`[Mac] Launch wrapper: ${wrapperPath}`);
        return spawn(wrapperPath, args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
      }

      console.log(`[Mac] Open app bundle: ${appPath}`);
      return spawn("open", ["-a", appPath, "--args", ...args], { detached: true, stdio: ["ignore", "pipe", "pipe"] });
    }

    return spawn(binaryPath, args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
  }

  getEmulatorConfigPath(emulatorId: string): string {
    const home = homedir();

    switch (emulatorId) {
      case "dolphin":
        return path.join(home, "Library", "Application Support", "Dolphin", "Config");
      case "mesen":
        return path.join(home, "Library", "Application Support", "Mesen2");
      case "ares":
        return path.join(home, "Library", "Application Support", "ares");
      case "melonds":
        return path.join(home, "Library", "Preferences", "melonDS");
      default:
        return path.join(home, "Library", "Application Support", emulatorId);
    }
  }

  getPlatformId(): "macos" {
    return "macos";
  }

  getPlatform(): Platform {
    return "darwin";
  }

  // json helpers

  readJson<T = unknown>(filePath: string, fallback: T = {} as T): T {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
    } catch {
      return fallback;
    }
  }

  writeJson(filePath: string, data: unknown): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, filePath);
  }

  updateJson<T = unknown>(filePath: string, updater: (current: T) => T, fallback: T = {} as T): void {
    const current = this.readJson<T>(filePath, fallback);
    const next = updater(current);
    this.writeJson(filePath, next);
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
      this.tryExec(`hdiutil attach -nobrowse -noautoopen -mountpoint "${mountPoint}" "${filePath}"`);
      const appBundles = this.findAllAppBundles(mountPoint);
      if (appBundles.length === 0) throw new Error("No .app bundle found inside DMG.");

      for (const appPath of appBundles) {
        console.log(`[Mac] Copy app: ${path.basename(appPath)} -> ${destDir}`);
        this.tryExec(`cp -R "${appPath}" "${destDir}/"`);
      }
    } finally {
      if (fs.existsSync(mountPoint)) this.unmountDmg(mountPoint);
    }
  }

  private mountDmgReadonly(dmgPath: string): string {
    const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`).toString();
    const mountPoint = mountOutput.match(/\/Volumes\/[^\n\r]*/)?.[0].trim() || "";
    if (!mountPoint) throw new Error("Could not mount DMG");
    return mountPoint;
  }

  private unmountDmg(mountPoint: string): void {
    this.tryExec(`hdiutil detach "${mountPoint}" -force`, true);
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

  private isWrapperScript(wrapperPath: string): boolean {
    try {
      const content = fs.readFileSync(wrapperPath, "utf8");
      return content.startsWith("#!/bin/bash");
    } catch {
      return false;
    }
  }

  private clearMesenSupportDir(): void {
    const mesenSupportDir = path.join(homedir(), "Library", "Application Support", "Mesen2");
    if (fs.existsSync(mesenSupportDir)) {
      console.log("[Mac] Reset Mesen2 support dir");
      fs.rmSync(mesenSupportDir, { recursive: true, force: true });
    }
  }

  private async ensureWrapper(targetBinary: string, verbose?: boolean): Promise<void> {
    const binaryDir = path.dirname(targetBinary);
    const binaryName = path.basename(targetBinary);
    const realBinaryName = `${binaryName}.real`;
    const realBinaryPath = path.join(binaryDir, realBinaryName);

    if (fs.existsSync(realBinaryPath)) {
      if (verbose) console.log("[Mac] Wrapper already present; skipping");
      return;
    }

    console.log(`[Mac] Create wrapper for: ${binaryName}`);

    try {
      fs.renameSync(targetBinary, realBinaryPath);

      const scriptContent = [
        "#!/bin/bash",
        'DIR="$(cd "$(dirname "$0")" && pwd)"',
        'export DYLD_LIBRARY_PATH="$DIR:$DYLD_LIBRARY_PATH"',
        `exec "$DIR/${realBinaryName}" "$@"`,
      ].join("\n");

      fs.writeFileSync(targetBinary, scriptContent, "utf-8");
      this.tryChmod(targetBinary);
      this.tryChmod(realBinaryPath);

      await this.removeQuarantine(realBinaryPath);
      await this.adHocSign(realBinaryPath);

      console.log("[Mac] Wrapper ok");
    } catch (err) {
      console.error(`[Mac] Wrapper failed: ${err?.message ?? err}`);
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

  private async removeQuarantine(filePath: string): Promise<void> {
    try {
      execSync(`xattr -r -d com.apple.quarantine "${filePath}"`, { stdio: "ignore" });
      console.log(`[Mac] Unquarantine: ${path.basename(filePath)}`);
    } catch (err) {
      void err;
    }
  }

  private async adHocSign(filePath: string): Promise<void> {
    try {
      this.tryExec(`codesign --remove-signature "${filePath}"`, true);
      execSync(`codesign --force --sign - --preserve-metadata=entitlements "${filePath}"`, { stdio: "ignore" });
    } catch (err) {
      void err;
    }
  }

  private async deepSign(appPath: string): Promise<void> {
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: "ignore" });
    } catch (err) {
      console.error(`[Mac] Deep sign failed: ${err?.message ?? err}`);
    }
  }
}