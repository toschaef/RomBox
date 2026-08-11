import type { Game, Platform } from "../../shared/types";
import type { EngineID } from "../../shared/types/engines";
import { ENGINE_IDS } from "../../shared/emulators/catalog";
import type { EmulatorPaths, PlatformRoots } from "./types";

import { aresPaths } from "./ares/paths";
import { azaharPaths } from "./azahar/paths";
import { dolphinPaths } from "./dolphin/paths";
import { duckstationPaths } from "./duckstation/paths";
import { melondsPaths } from "./melonds/paths";
import { mesenPaths } from "./mesen/paths";
import { pcsx2Paths } from "./pcsx2/paths";

// the path half of the emulator registry
const PATHS: Record<EngineID, Partial<Record<Platform, EmulatorPaths>>> = {
  mesen: mesenPaths,
  melonds: melondsPaths,
  azahar: azaharPaths,
  dolphin: dolphinPaths,
  ares: aresPaths,
  duckstation: duckstationPaths,
  pcsx2: pcsx2Paths,
};

function getPaths(engineId: EngineID, platform: Platform): EmulatorPaths {
  const byPlatform = PATHS[engineId];
  if (!byPlatform) throw new Error(`Unknown emulator: ${engineId}`);

  const paths = byPlatform[platform];
  if (!paths) throw new Error(`${engineId} is not supported on ${platform}`);
  return paths;
}

/** The emulator's root directory. */
export function resolveBasePath(
  engineId: EngineID,
  platform: Platform,
  roots: PlatformRoots
): string {
  return getPaths(engineId, platform).base(roots);
}

/** Where the emulator reads its config files. Defaults to the base directory. */
export function resolveConfigPath(
  engineId: EngineID,
  platform: Platform,
  roots: PlatformRoots
): string {
  const paths = getPaths(engineId, platform);
  const base = paths.base(roots);
  return paths.config ? paths.config(roots, base) : base;
}

// where the emulator's BIOS/firmware installs, or null if it needs none
export function resolveBiosPath(
  engineId: EngineID,
  platform: Platform,
  roots: PlatformRoots
): string | null {
  const paths = getPaths(engineId, platform);
  if (!paths.bios) return null;
  return paths.bios(roots, paths.base(roots));
}

/** Where the emulator writes saves for a given game. */
export function resolveSavePath(
  game: Game,
  platform: Platform,
  roots: PlatformRoots
): string {
  const paths = getPaths(game.engineId, platform);
  return paths.saves({ game, roots, base: paths.base(roots) });
}

/** Every emulator base directory, used when wiping platform data. */
export function allBasePaths(platform: Platform, roots: PlatformRoots): string[] {
  return ENGINE_IDS.flatMap((engineId) => {
    const paths = PATHS[engineId]?.[platform];
    return paths ? [paths.base(roots)] : [];
  });
}
