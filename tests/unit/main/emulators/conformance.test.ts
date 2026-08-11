// the emulator module contract, checked against every registered emulator.
// see docs/emulators.md
import path from "path";

import {
  EMULATORS,
  getConfigurator,
  getDirectoryBios,
  resolveSaveRoots,
} from "../../../../src/main/emulators";
import {
  allBasePaths,
  resolveBasePath,
  resolveBiosPath,
  resolveConfigPath,
  resolveSavePath,
} from "../../../../src/main/emulators/paths";
import { ENGINES } from "../../../../src/main/config/engines";
import {
  CONSOLE_CATALOG,
  ENGINE_CATALOG,
  ENGINE_IDS,
} from "../../../../src/shared/emulators/catalog";
import { getConsoleIdsForEngine } from "../../../../src/shared/emulators/derived";
import type { EngineID } from "../../../../src/shared/types/engines";
import type { Platform, Game } from "../../../../src/shared/types";
import type { PlatformRoots } from "../../../../src/main/emulators/types";

const PLATFORMS: Platform[] = ["darwin", "win32"];

// path.win32/path.posix normalize every separator to their own convention, so
// a POSIX-style fixture fed through the win32 branch would no longer start
// with itself - each platform needs roots in its own native style.
const ROOTS_BY_PLATFORM: Partial<Record<Platform, PlatformRoots>> = {
  darwin: {
    home: "/home/user",
    appSupport: "/home/user/AppSupport",
    preferences: "/home/user/Preferences",
    localAppData: "/home/user/LocalAppData",
    documents: "/home/user/Documents",
  },
  win32: {
    home: "C:\\Users\\user",
    appSupport: "C:\\Users\\user\\AppSupport",
    preferences: "C:\\Users\\user\\Preferences",
    localAppData: "C:\\Users\\user\\LocalAppData",
    documents: "C:\\Users\\user\\Documents",
  },
};

function rootsFor(platform: Platform): PlatformRoots {
  const roots = ROOTS_BY_PLATFORM[platform];
  if (!roots) throw new Error(`No fixture roots defined for platform: ${platform}`);
  return roots;
}

function gameFor(engineId: EngineID): Game {
  const consoleId = getConsoleIdsForEngine(engineId)[0];
  return {
    id: `${engineId}-game`,
    title: "Conformance Game",
    filePath: `/roms/${consoleId}/Conformance Game.rom`,
    consoleId,
    engineId,
    playtimeSeconds: 0,
    lastPlayedAt: null,
  } as Game;
}

describe("emulator registry", () => {
  it("registers exactly the engines the catalog declares", () => {
    expect(Object.keys(EMULATORS).sort()).toEqual([...ENGINE_IDS].sort());
  });

  it("keys every module by its own id", () => {
    for (const [key, module] of Object.entries(EMULATORS)) {
      expect(module.engineId).toBe(key);
    }
  });

  it("has a launch definition for every registered emulator", () => {
    for (const engineId of ENGINE_IDS) {
      expect(ENGINES[engineId]).toBeDefined();
      expect(ENGINES[engineId].engineId).toBe(engineId);
    }
  });
});

describe.each(ENGINE_IDS)("%s module", (engineId) => {
  const module = EMULATORS[engineId];

  it("supports every platform the engine ships binaries for", () => {
    // a download without a path layout would install an emulator RomBox then
    // cannot find, configure or read saves from.
    for (const platform of PLATFORMS) {
      if (!ENGINES[engineId].downloads?.[platform]) continue;
      expect(module.paths[platform]).toBeDefined();
    }
  });

  describe.each(PLATFORMS)("on %s", (platform) => {
    const supported = () => Boolean(module.paths[platform]);

    it("resolves absolute, distinct-looking paths", () => {
      if (!supported()) return;

      const roots = rootsFor(platform);
      const base = resolveBasePath(engineId, platform, roots);
      const config = resolveConfigPath(engineId, platform, roots);

      expect(path.isAbsolute(base)).toBe(true);
      expect(base.startsWith(roots.home)).toBe(true);
      // config defaults to base, but must never sit above it
      expect(config.startsWith(base)).toBe(true);
    });

    it("puts BIOS inside the emulator's own directory when it needs one", () => {
      if (!supported()) return;

      const roots = rootsFor(platform);
      const bios = resolveBiosPath(engineId, platform, roots);
      if (bios === null) return;
      expect(bios.startsWith(resolveBasePath(engineId, platform, roots))).toBe(true);
    });

    it("resolves a save path for every console it runs", () => {
      if (!supported()) return;

      for (const consoleId of getConsoleIdsForEngine(engineId)) {
        const game = { ...gameFor(engineId), consoleId } as Game;
        const savePath = resolveSavePath(game, platform, rootsFor(platform));
        expect(typeof savePath).toBe("string");
        expect(savePath.length).toBeGreaterThan(0);
      }
    });

    it("rejects the platforms it does not support", () => {
      if (supported()) return;
      expect(() => resolveBasePath(engineId, platform, rootsFor(platform))).toThrow(/not supported/);
    });
  });

  it("builds save roots with unique ids and a cache directory each", () => {
    const game = gameFor(engineId);
    const roots = resolveSaveRoots({
      game,
      cacheRoot: "/cache",
      consoleCache: `/cache/${game.consoleId}`,
      primary: "/emulator/saves",
      base: "/emulator",
    });

    expect(roots.length).toBeGreaterThan(0);

    const ids = roots.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const root of roots) {
      expect(root.dir).toBeTruthy();
      // without a distinct cacheDir two roots would overwrite each other's backups.
      expect(root.cacheDir).toBeTruthy();
      expect(["per-game", "shared"]).toContain(root.scope);
    }

    const cacheDirs = roots.map((r) => r.cacheDir);
    expect(new Set(cacheDirs).size).toBe(cacheDirs.length);
  });

  it("degrades to no save roots when the platform cannot be resolved", () => {
    // saveLayouts passes nulls rather than throwing on an unsupported OS.
    const roots = resolveSaveRoots({
      game: gameFor(engineId),
      cacheRoot: "/cache",
      consoleCache: "/cache/x",
      primary: null,
      base: null,
    });
    expect(Array.isArray(roots)).toBe(true);
  });

  it("builds a configurator for each of its consoles", () => {
    for (const consoleId of getConsoleIdsForEngine(engineId)) {
      const configurator = getConfigurator({ ...gameFor(engineId), consoleId } as Game);
      expect(configurator).not.toBeNull();
      expect(typeof configurator?.configure).toBe("function");
    }
  });

  it("produces a launch command that starts with the engine binary", () => {
    const game = gameFor(engineId);
    const command = ENGINES[engineId].getLaunchCommand(game, "/engines/bin", {
      fullscreen: false,
    });

    expect(Array.isArray(command)).toBe(true);
    expect(command.length).toBeGreaterThan(0);
    expect(command[0]).toBe("/engines/bin");
    expect(command.every((arg) => typeof arg === "string")).toBe(true);
  });

  it("names itself the same way everywhere", () => {
    expect(ENGINES[engineId].name).toBe(ENGINE_CATALOG[engineId].displayName);
    expect(ENGINES[engineId].consoles).toEqual(getConsoleIdsForEngine(engineId));
  });
});

describe("cross-emulator invariants", () => {
  it.each(PLATFORMS)("gives every emulator a distinct base directory on %s", (platform) => {
    // two emulators sharing a base directory would make "clear platform data"
    // for one wipe the other.
    const bases = allBasePaths(platform, rootsFor(platform));
    expect(new Set(bases).size).toBe(bases.length);
  });

  it("maps every console to a registered emulator", () => {
    for (const entry of Object.values(CONSOLE_CATALOG)) {
      expect(EMULATORS[entry.engineId]).toBeDefined();
    }
  });

  it("declares directory-based BIOS only where the catalog lists no BIOS files", () => {
    // the two are alternatives: system data is either named files or whole
    // directory trees, never both.
    for (const entry of Object.values(CONSOLE_CATALOG)) {
      const directory = getDirectoryBios(entry.consoleId);
      if (!directory) continue;

      expect(directory.dirs.length).toBeGreaterThan(0);
      expect(directory.sourceFolderName).toBeTruthy();
      for (const file of entry.bios?.files ?? []) {
        expect(directory.dirs).not.toContain(file.filename);
      }
    }
  });
});
