// Mock 'os' at the very top before any service/config imports are resolved
jest.mock("os", () => {
  return {
    ...jest.requireActual("os"),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    homedir: () => require("../helpers/tempDirs").suiteUserDataDir(),
  };
});

import { suiteUserDataDir } from "../helpers/tempDirs";
import path from "path";
import fs from "fs";
import { ipcMain as electronIpcMain } from "electron";
const ipcMain = electronIpcMain as unknown as typeof import("../__mocks__/electron").ipcMain;
import { initDB } from "../../src/main/data/db";
import registerSettingsHandlers from "../../src/main/ipc/settingsHandler";
import registerGameHandlers from "../../src/main/ipc/gameHandlers";
import registerBiosHandlers from "../../src/main/ipc/biosHandler";
import registerEngineHandlers from "../../src/main/ipc/engineHandlers";
import registerControlsHandlers from "../../src/main/ipc/controlsHandler";
import registerSaveHandlers from "../../src/main/ipc/saveHandler";
import { LibraryService } from "../../src/main/services/LibraryService";
import type { Game } from "../../src/shared/types";

describe("IPC Handler Integration Tests", () => {
  const tempDir = suiteUserDataDir();

  beforeAll(() => {
    // Ensure all IPC handlers are registered
    registerSettingsHandlers();
    registerGameHandlers();
    registerBiosHandlers();
    registerEngineHandlers();
    registerControlsHandlers();
    registerSaveHandlers();
  });

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    ipcMain._clearHandlers();
  });

  describe("Settings IPC Handlers", () => {
    it("should set and get a setting via IPC", async () => {
      // Set setting
      const setRes = (await ipcMain._invoke("settings:set", {
        key: "controls.activeProfileId",
        value: "profile-1",
      })) as { success: boolean };
      expect(setRes.success).toBe(true);

      // Get setting
      const getRes = await ipcMain._invoke("settings:get", "controls.activeProfileId");
      expect(getRes).toBe("profile-1");
    });

    it("should reset settings to default via IPC", async () => {
      await ipcMain._invoke("settings:set", {
        key: "controls.activeProfileId",
        value: "profile-2",
      });

      await ipcMain._invoke("settings:reset", "controls.activeProfileId");
      const getRes = await ipcMain._invoke("settings:get", "controls.activeProfileId");
      expect(getRes).toBe(""); // default is ""
    });
  });

  describe("Game IPC Handlers", () => {
    const mockGame: Game = {
      id: "ipc-game",
      title: "IPC Test Game",
      filePath: "/roms/nes/ipc-game.nes",
      consoleId: "nes",
      engineId: "mesen",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
    };

    it("should fetch all games and get a specific game via IPC", async () => {
      // Directly seed the database via LibraryService
      LibraryService.createGame(mockGame);

      // Fetch all games via IPC
      const getListRes = (await ipcMain._invoke("game:getAll")) as { success: boolean; games: { title: string }[] };
      expect(getListRes.success).toBe(true);
      expect(getListRes.games).toHaveLength(1);
      expect(getListRes.games[0].title).toBe("IPC Test Game");

      // Fetch specific game via IPC
      const getGameRes = (await ipcMain._invoke("game:get", "ipc-game")) as { success: boolean; game: { title: string } };
      expect(getGameRes.success).toBe(true);
      expect(getGameRes.game.title).toBe("IPC Test Game");
    });

    it("should update and delete games via IPC", async () => {
      LibraryService.createGame(mockGame);

      // Update game via IPC
      const updated = { ...mockGame, title: "IPC Updated Title" };
      const updateRes = (await ipcMain._invoke("game:update", updated)) as { success: boolean };
      expect(updateRes.success).toBe(true);

      const checkRes = (await ipcMain._invoke("game:get", "ipc-game")) as { game: { title: string } };
      expect(checkRes.game.title).toBe("IPC Updated Title");

      // Delete game via IPC. The rom lives under userData/roms, so it is a copy
      // rombox extracted itself and deleting the entry removes it too.
      const romPath = path.join(tempDir, "roms", "nes", "ipc-game.nes");
      fs.mkdirSync(path.dirname(romPath), { recursive: true });
      fs.writeFileSync(romPath, "mock-rom");
      const testGame = { ...mockGame, filePath: romPath };
      LibraryService.createGame(testGame);

      const deleteRes = (await ipcMain._invoke("game:delete", "ipc-game")) as { success: boolean };
      expect(deleteRes.success).toBe(true);
      expect(fs.existsSync(romPath)).toBe(false);
    });

    it("should keep a referenced rom on disk when the game is deleted", async () => {
      const romPath = path.join(tempDir, "elsewhere", "kept-game.nes");
      fs.mkdirSync(path.dirname(romPath), { recursive: true });
      fs.writeFileSync(romPath, "mock-rom");
      LibraryService.createGame({ ...mockGame, id: "kept-game", filePath: romPath });

      const deleteRes = (await ipcMain._invoke("game:delete", "kept-game")) as { success: boolean };
      expect(deleteRes.success).toBe(true);
      expect(fs.existsSync(romPath)).toBe(true);
    });

    it("should report a game whose file has gone missing", async () => {
      const romPath = path.join(tempDir, "elsewhere", "moved-game.nes");
      fs.mkdirSync(path.dirname(romPath), { recursive: true });
      fs.writeFileSync(romPath, "mock-rom");
      LibraryService.createGame({ ...mockGame, id: "moved-game", filePath: romPath });

      let res = (await ipcMain._invoke("game:get", "moved-game")) as { game: Game };
      expect(res.game.fileMissing).toBe(false);

      fs.rmSync(romPath);

      res = (await ipcMain._invoke("game:get", "moved-game")) as { game: Game };
      expect(res.game.fileMissing).toBe(true);
    });

    it("should relocate a moved game to its new path via IPC", async () => {
      const originalPath = path.join(tempDir, "elsewhere", "relocate-me.nes");
      const movedPath = path.join(tempDir, "moved", "relocate-me.nes");
      fs.mkdirSync(path.dirname(originalPath), { recursive: true });
      fs.mkdirSync(path.dirname(movedPath), { recursive: true });
      fs.writeFileSync(originalPath, "NES\x1a\x01\x01");
      LibraryService.createGame({ ...mockGame, id: "relocate-me", filePath: originalPath });

      fs.renameSync(originalPath, movedPath);

      const relocateRes = (await ipcMain._invoke(
        "game:relocate",
        "relocate-me",
        movedPath
      )) as { success: boolean };
      expect(relocateRes.success).toBe(true);

      const res = (await ipcMain._invoke("game:get", "relocate-me")) as { game: Game };
      expect(res.game.filePath).toBe(movedPath);
      expect(res.game.fileMissing).toBe(false);
    });
  });

  describe("Bios IPC Handlers", () => {
    it("should return BIOS status via IPC", async () => {
      const statusRes = (await ipcMain._invoke("bios:get")) as { success: boolean; items: unknown[] };
      expect(statusRes.success).toBe(true);
      expect(statusRes.items.length).toBeGreaterThan(0);
    });
  });

  describe("Engine IPC Handlers", () => {
    it("should list all engines via IPC", async () => {
      const enginesRes = (await ipcMain._invoke("engine:get")) as unknown[];
      expect(enginesRes.length).toBeGreaterThan(0);
      const mesen = enginesRes.find((e: unknown) => (e as { engineId: string }).engineId === "mesen") as { name: string } | undefined;
      expect(mesen).toBeDefined();
      expect(mesen.name).toBe("Mesen 2");
    });
  });
});
