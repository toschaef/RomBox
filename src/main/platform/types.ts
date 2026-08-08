import { ChildProcess } from "child_process";
import { Platform, Game } from "../../shared/types";
import type { EngineID } from "../../shared/types/engines";
import type { PlatformRoots } from "../emulators/types";

export interface PlatformHandler {

  /** extracts downloaded archive */
  extractArchive(filePath: string, destDir: string): Promise<void>;
  
  /**  post install cleanup  */
  finalizeInstall(binaryPath: string, needsWrapper: boolean): Promise<void>;
  
  /** extracts and installs a dependency */
  installDependency(filePath: string, targetDir: string, searchName: string, targetFilename: string): Promise<void>;
  
  /** cleans up config files */
  clearPlatformData(): Promise<void>;

  /** prepares permissions and spawns a process */
  launchProcess(binaryPath: string, args: string[], opts?: { cwd?: string }): ChildProcess;

  // the OS directories emulator paths are built from
  getRoots(): PlatformRoots;

  /** returns directory where the emulator stores its INI/config files */
  getEmulatorConfigPath(engineId: EngineID): string;
  /** returns directory where the os stores the emulator files */
  getEmulatorBasePath(engineId: EngineID): string
  /** returns directory where game save is stored */
  getSavePath(game: Game): string;
  /** returns directory where the emulator's BIOS installs, or null if it needs none */
  getBiosPath(engineId: EngineID): string | null;

  getPlatformId(): "macos" | "windows" | "linux";
  getPlatform(): Platform;
}