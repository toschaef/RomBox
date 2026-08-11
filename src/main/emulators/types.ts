import type { Game, Platform } from "../../shared/types";
import type { SaveRootBuilder } from "./saveRoots";
import type { EmulatorConfigurator } from "./configuratorTypes";
import type { EngineID } from "../../shared/types/engines";

// os directories emulator paths are built from. platform handlers supply
// these and nothing more.
export interface PlatformRoots {
  home: string;
  /** mac ~/Library/Application Support, win %APPDATA% */
  appSupport: string;
  /** mac ~/Library/Preferences, win %APPDATA% */
  preferences: string;
  /** mac ~/Library/Application Support, win %LOCALAPPDATA% */
  localAppData: string;
  documents: string;
}

export interface DirectoryBios {
  dirs: string[];
  /** folder name the user must select when installing */
  sourceFolderName: string;
  selectionHint: string;
  incompleteMessage: string;
}

export interface SavePathContext {
  game: Game;
  roots: PlatformRoots;
  base: string;
}

// where one emulator keeps its files on one platform. base is resolved first
// and handed to the others.
export interface EmulatorPaths {
  base(roots: PlatformRoots): string;
  /** defaults to base */
  config?(roots: PlatformRoots, base: string): string;
  /** omit for emulators that need none */
  bios?(roots: PlatformRoots, base: string): string;
  saves(ctx: SavePathContext): string;
}

// see docs/emulators.md
export interface EmulatorModule {
  engineId: EngineID;
  /** absent platforms are unsupported */
  paths: Partial<Record<Platform, EmulatorPaths>>;
  saveRoots: SaveRootBuilder;
  directoryBios?: DirectoryBios;
  // configurators take different args, so the factory hides that
  createConfigurator(game: Game): EmulatorConfigurator;
}
