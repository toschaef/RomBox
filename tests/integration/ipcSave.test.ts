jest.mock("os", () => {
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata"),
  };
});

import path from "path";
import fs from "fs";
const ipcMain = require("electron").ipcMain as any;
import { initDB } from "../../src/main/data/db";
import registerSaveHandlers from "../../src/main/ipc/saveHandler";
import { LibraryService } from "../../src/main/services/LibraryService";
import type { Game } from "../../src/shared/types";

describe("IPC Save Handler Integration Tests", () => {
  const tempDir = path.resolve(__dirname, "../temp-userdata");
  const mockGame: Game = {
    id: "save-game",
    title: "Save Test Game",
    filePath: path.join(tempDir, "saves-parent/game.nes"),
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: 0,
  };

  beforeAll(() => {
    registerSaveHandlers();
  });

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(path.join(tempDir, "saves-parent"), { recursive: true });
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

  it("should return game not found when querying nonexistent gameId", async () => {
    const statusRes = await ipcMain._invoke("save:status", { gameId: "nonexistent" });
    expect(statusRes.success).toBe(false);
    expect(statusRes.message).toBe("Game not found");
  });

  it("should manage save states via IPC", async () => {
    // 1. Seed game in db
    LibraryService.createGame(mockGame);

    // Create a mock emulator save file on the emulator's save folder:
    // Mesen save folder: temp-userdata/Library/Application Support/Mesen2/Saves
    const mesenSaveDir = path.join(tempDir, "Library", "Application Support", "Mesen2", "Saves");
    fs.mkdirSync(mesenSaveDir, { recursive: true });
    
    const saveFilePath = path.join(mesenSaveDir, "game.sav");
    fs.writeFileSync(saveFilePath, "mock-save-data");

    // 2. Query status via IPC
    const statusRes = await ipcMain._invoke("save:status", { gameId: mockGame.id });
    expect(statusRes.success).toBe(true);
    expect(statusRes.status.hasCachedSave).toBe(false);

    // 3. Trigger backup via IPC
    const backupRes = await ipcMain._invoke("save:backup", { gameId: mockGame.id });
    expect(backupRes.success).toBe(true);

    // Verify local backup now exists in status
    const statusRes2 = await ipcMain._invoke("save:status", { gameId: mockGame.id });
    expect(statusRes2.status.hasCachedSave).toBe(true);

    // 4. List all saves via IPC
    const listRes = await ipcMain._invoke("save:list");
    expect(listRes.success).toBe(true);
    expect(listRes.saves.length).toBeGreaterThan(0);

    // 5. Delete local backup cache
    const deleteRes = await ipcMain._invoke("save:delete", { gameId: mockGame.id });
    expect(deleteRes.success).toBe(true);

    const statusRes3 = await ipcMain._invoke("save:status", { gameId: mockGame.id });
    expect(statusRes3.status.hasCachedSave).toBe(false);
  });
});
