// Mock 'os' at the very top before any service/config imports are resolved
jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata"),
  };
});

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
  const tempDir = path.resolve(__dirname, "../temp-userdata");

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

      // Delete game via IPC
      // Since fs.unlinkSync is called, let's create the fake rom file
      const romPath = path.join(tempDir, "ipc-game.nes");
      fs.writeFileSync(romPath, "mock-rom");
      const testGame = { ...mockGame, filePath: romPath };
      LibraryService.createGame(testGame);

      const deleteRes = (await ipcMain._invoke("game:delete", "ipc-game")) as { success: boolean };
      expect(deleteRes.success).toBe(true);
      expect(fs.existsSync(romPath)).toBe(false);
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
