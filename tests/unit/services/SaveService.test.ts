import fs from "fs";
import path from "path";
import { SaveService } from "../../../src/main/services/SaveService";
import { app, dialog } from "electron";
import type { Game } from "../../../src/shared/types";
import AdmZip from "adm-zip";

jest.mock("../../../src/main/platform", () => ({
  osHandler: {
    getSavePath: jest.fn().mockImplementation((game: Game) => {
      // Return a path inside our temp directory representing emulator save path
      return path.resolve(__dirname, `../../temp-userdata/emulator_saves/${game.consoleId}`);
    })
  }
}));

describe("SaveService", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");
  
  const mockGame: Game = {
    id: "mario-bros",
    title: "Super Mario Bros.",
    filePath: "/roms/smb.nes",
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should return empty save status when no saves exist", () => {
    const status = SaveService.getSaveStatus(mockGame);
    expect(status.hasCachedSave).toBe(false);
    expect(status.cachedFiles).toHaveLength(0);
    expect(status.emulatorSaveDir).toContain("emulator_saves/nes");
  });

  it("should backup saves from emulator to cache", () => {
    const emulatorDir = path.join(tempDir, "emulator_saves/nes");
    fs.mkdirSync(emulatorDir, { recursive: true });
    fs.writeFileSync(path.join(emulatorDir, "smb.sav"), "mock_save_data");

    const result = SaveService.backupSave(mockGame);
    expect(result.success).toBe(true);
    expect(result.backedUpFiles).toContain("smb.sav");

    const status = SaveService.getSaveStatus(mockGame);
    expect(status.hasCachedSave).toBe(true);
    expect(status.cachedFiles[0].fileName).toBe("smb.sav");
  });

  it("should restore saves from cache to emulator", () => {
    // Create cached save
    const cacheDir = path.join(tempDir, "saves/nes");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "smb.sav"), "cached_data");

    const result = SaveService.restoreSave(mockGame);
    expect(result.success).toBe(true);
    expect(result.restoredFiles).toContain("smb.sav");

    const emulatorDir = path.join(tempDir, "emulator_saves/nes");
    expect(fs.readFileSync(path.join(emulatorDir, "smb.sav"), "utf-8")).toBe("cached_data");
  });

  it("should skip restoring if emulator save is newer than cached save", () => {
    const cacheDir = path.join(tempDir, "saves/nes");
    fs.mkdirSync(cacheDir, { recursive: true });
    const cachedFile = path.join(cacheDir, "smb.sav");
    fs.writeFileSync(cachedFile, "cached_data");

    // set older time for cached file
    const pastTime = new Date();
    pastTime.setHours(pastTime.getHours() - 2);
    fs.utimesSync(cachedFile, pastTime, pastTime);

    const emulatorDir = path.join(tempDir, "emulator_saves/nes");
    fs.mkdirSync(emulatorDir, { recursive: true });
    const emulatorFile = path.join(emulatorDir, "smb.sav");
    fs.writeFileSync(emulatorFile, "newer_emulator_data");

    const result = SaveService.restoreSave(mockGame);
    expect(result.success).toBe(true);
    expect(result.restoredFiles).not.toContain("smb.sav");
    expect(fs.readFileSync(emulatorFile, "utf-8")).toBe("newer_emulator_data");
  });

  it("should delete cached saves", () => {
    const cacheDir = path.join(tempDir, "saves/nes");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "smb.sav"), "cached_data");

    const result = SaveService.deleteCachedSave(mockGame);
    expect(result.success).toBe(true);
    expect(result.deletedFiles).toContain("smb.sav");
    expect(fs.existsSync(path.join(cacheDir, "smb.sav"))).toBe(false);
  });

  it("should list all saves across consoles", () => {
    const cacheDir = path.join(tempDir, "saves/nes");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "smb.sav"), "cached_data");

    const saves = SaveService.listAllSaves();
    expect(saves.length).toBeGreaterThan(0);
    expect(saves[0].consoleId).toBe("nes");
    expect(saves[0].gameFileName).toBe("smb.sav");
  });

  it("should export cached save to zip/sav through electron dialog", async () => {
    const cacheDir = path.join(tempDir, "saves/nes");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "smb.sav"), "cached_data");

    const destPath = path.join(tempDir, "exported_smb.sav");
    (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
      canceled: false,
      filePath: destPath
    });

    const result = await SaveService.exportSave(mockGame);
    expect(result.success).toBe(true);
    expect(result.exportedTo).toBe(destPath);
    expect(fs.readFileSync(destPath, "utf-8")).toBe("cached_data");
  });
});
