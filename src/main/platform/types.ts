import { ChildProcess } from "child_process";
import { Platform, Game } from "../../shared/types";
import type { EngineID } from "../../shared/types/engines";

export interface PlatformHandler {

  /** extracts downloaded archive */
  extractArchive(filePath: string, destDir: string): Promise<void>;
  
  /**  post install cleanup  */
  finalizeInstall(binaryPath: string, needsWrapper: boolean): Promise<void>;
  
  /** extracts and installs a dependency */
  installDependency(filePath: string, targetDir: string, searchName: string, targetFilename: string): Promise<void>;
  
  /** finds binary */
  resolveBinaryPath(installDir: string, binaryConfigPath: string): Promise<string>;

  /** cleans up config files */
  clearPlatformData(): void;

  /** prepares permissions and spawns a process */
  launchProcess(binaryPath: string, args: string[], opts?: { cwd?: string }): ChildProcess;

  /** returns directory where the emulator stores its INI/config files */
  getEmulatorConfigPath(engineId: EngineID): string;
  /** returns directory where the os stores the emulator files */
  getEmulatorBasePath(engineId: EngineID): string
  /** returns directory where game save is stored */
  getSavePath(game: Game): string;

  getPlatformId(): "macos" | "windows" | "linux";
  getPlatform(): Platform;

  readJson<T = unknown>(filePath: string, fallback?: T): T;
  writeJson(filePath: string, data: unknown): void;
  updateJson<T = unknown>(filePath: string, updater: (current: T) => T, fallback?: T): void;
}