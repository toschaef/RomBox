// characterization snapshot of every emulator path rombox resolves.
// a diff here means saves, configs or bios moved on disk - treat it as a
// bug unless the change is deliberate. see docs/architecture.md
import path from "path";

import { MacHandler } from "../../../../src/main/platform/MacHandler";
import { WinHandler } from "../../../../src/main/platform/WinHandler";
import { ENGINES } from "../../../../src/main/config/engines";
import { getSaveRoots } from "../../../../src/main/config/saveLayouts";
import type { PlatformHandler } from "../../../../src/main/platform/types";
import type { Game, ConsoleID } from "../../../../src/shared/types";
import type { EngineID } from "../../../../src/shared/types/engines";

const MOCK_HOME = "/mock/home";
const WIN_HOME = "C:\\Users\\TestUser";
const CACHE_ROOT = "/cache/saves";

jest.mock("os", () => ({
  ...jest.requireActual("os"),
  homedir: () => "/mock/home",
}));

jest.mock("child_process", () => ({
  ...jest.requireActual("child_process"),
  spawn: jest.fn(),
  exec: jest.fn(),
  execSync: jest.fn(),
}));

// saveLayouts resolves through the osHandler singleton. Point it at whichever
// real handler the current matrix row is exercising.
let mockActiveHandler: PlatformHandler;
jest.mock("../../../../src/main/platform", () => ({
  get osHandler() {
    return mockActiveHandler;
  },
}));

function makeGame(consoleId: ConsoleID, engineId: EngineID): Game {
  return {
    id: "game-1",
    title: "Test Game",
    filePath: `/roms/${consoleId}/Test Game.rom`,
    consoleId,
    engineId,
    playtimeSeconds: 0,
    lastPlayedAt: 0,
  } as Game;
}

/** Replace machine-specific roots so snapshots are stable across hosts. */
function normalize(value: string): string {
  // collapse both separators first: WinHandler runs on a posix host here, so a
  // single path can mix "C:\Users\X" (from env) with "/" (from path.join).
  const slashed = value.split(path.sep).join("/").split("\\").join("/");
  return slashed
    .replace(WIN_HOME.split("\\").join("/"), "<HOME>")
    .replace(MOCK_HOME, "<HOME>")
    .replace(CACHE_ROOT, "<CACHE>");
}

/** SaveRoot holds RegExps and functions; render a stable, readable shape. */
function describeSaveRoots(game: Game): unknown[] {
  return getSaveRoots(game, CACHE_ROOT).map((root) => ({
    id: root.id,
    scope: root.scope,
    dir: normalize(root.dir),
    cacheDir: normalize(root.cacheDir),
    extensions: root.extensions,
    recursive: root.recursive ?? false,
    excludeDirs: root.excludeDirs,
    importFormats: root.importFormats,
    importPatterns: root.importPatterns?.map((r) => r.source),
    // only whether a namer is wired up; its behavior is covered by SaveImport tests.
    importFileName: root.importFileName ? "custom" : undefined,
  }));
}

const PLATFORMS: Array<{ name: string; make: () => PlatformHandler }> = [
  { name: "darwin", make: () => new MacHandler() },
  { name: "win32", make: () => new WinHandler() },
];

const ENGINE_IDS = Object.keys(ENGINES) as EngineID[];

describe("emulator path matrix (characterization)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, USERPROFILE: WIN_HOME };
    delete process.env.APPDATA;
    delete process.env.LOCALAPPDATA;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("covers every engine defined in ENGINES", () => {
    // guards the matrix against silently skipping a newly added emulator.
    expect(ENGINE_IDS.sort()).toEqual(
      ["ares", "azahar", "dolphin", "duckstation", "melonds", "mesen", "pcsx2"].sort()
    );
  });

  describe.each(PLATFORMS)("$name", ({ make }) => {
    beforeEach(() => {
      mockActiveHandler = make();
    });

    it.each(ENGINE_IDS)("resolves config and base paths for %s", (engineId) => {
      const handler = mockActiveHandler;
      expect({
        config: normalize(handler.getEmulatorConfigPath(engineId)),
        base: normalize(handler.getEmulatorBasePath(engineId)),
      }).toMatchSnapshot();
    });

    it.each(ENGINE_IDS)("resolves save paths and roots for %s", (engineId) => {
      const handler = mockActiveHandler;
      const consoles = ENGINES[engineId].consoles as ConsoleID[];

      const rows = consoles.map((consoleId) => {
        const game = makeGame(consoleId, engineId);
        return {
          consoleId,
          savePath: normalize(handler.getSavePath(game)),
          saveRoots: describeSaveRoots(game),
        };
      });

      expect(rows).toMatchSnapshot();
    });
  });

  describe("unsupported engines still throw", () => {
    it.each(PLATFORMS)("$name", ({ make }) => {
      const handler = make();
      const bogus = "nonexistent" as EngineID;
      expect(() => handler.getEmulatorConfigPath(bogus)).toThrow();
      expect(() => handler.getEmulatorBasePath(bogus)).toThrow();
    });
  });
});
