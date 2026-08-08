// the auto-install block used to be copy-pasted three times (game, bios dir,
// bios file), so these cover all three routes through it.
import fs from "fs";
import { ImportService } from "../../../../src/main/services/ImportService";
import { ScannerService } from "../../../../src/main/services/ScannerService";
import { LibraryService } from "../../../../src/main/services/LibraryService";
import { BiosService } from "../../../../src/main/services/BiosService";
import { EngineService } from "../../../../src/main/services/EngineService";
import { Extractor } from "../../../../src/main/utils/extractor";
import type { Game } from "../../../../src/shared/types";

jest.mock("../../../../src/main/services/ScannerService", () => ({
  ScannerService: { scanPath: jest.fn(), importGame: jest.fn() },
}));

jest.mock("../../../../src/main/services/LibraryService", () => ({
  LibraryService: { createGame: jest.fn() },
}));

jest.mock("../../../../src/main/services/BiosService", () => ({
  BiosService: { installBios: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../../../src/main/services/EngineService", () => ({
  EngineService: { getEnginePath: jest.fn(), installEngine: jest.fn() },
}));

jest.mock("../../../../src/main/utils/extractor", () => ({
  Extractor: { extractToFile: jest.fn().mockResolvedValue(undefined) },
}));

let autoInstallSetting = true;
jest.mock("../../../../src/main/services/SettingsService", () => ({
  settingsService: { get: () => autoInstallSetting },
}));

jest.mock("electron", () => ({
  app: { getPath: jest.fn().mockReturnValue("/tmp/rombox-test") },
}));

const game = { id: "g1", title: "Test Game", engineId: "mesen", consoleId: "nes" } as Game;

function gameScan() {
  return {
    type: "game" as const,
    consoleId: "nes" as const,
    engineId: "mesen" as const,
    filePath: "/drop/Test Game.nes",
  };
}

function biosScan(overrides = {}) {
  return {
    type: "bios" as const,
    consoleId: "ps1" as const,
    engineId: "duckstation" as const,
    filePath: "/drop/scph1001.bin",
    ...overrides,
  };
}

describe("ImportService.importPath", () => {
  let notify: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    autoInstallSetting = true;
    notify = jest.fn();

    (ScannerService.importGame as jest.Mock).mockResolvedValue(game);
    (LibraryService.createGame as jest.Mock).mockResolvedValue({ success: true, game });
    (EngineService.installEngine as jest.Mock).mockResolvedValue({ success: true });
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue("/engines/mesen");

    jest.spyOn(fs, "statSync").mockReturnValue({ isDirectory: () => false } as fs.Stats);
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    jest.spyOn(fs, "rmSync").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("imports a game and reports it", async () => {
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([gameScan()]);

    const result = await ImportService.importPath("/drop/Test Game.nes", notify);

    expect(result.success).toBe(true);
    expect(result.games).toEqual([game]);
    expect(result.biosCount).toBe(0);
    expect(LibraryService.createGame).toHaveBeenCalledWith(game);
  });

  it("labels an imported BIOS with its console name and file", async () => {
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([biosScan()]);

    const result = await ImportService.importPath("/drop/scph1001.bin", notify);

    expect(result.biosCount).toBe(1);
    expect(result.biosLabels).toEqual(["PS1 BIOS (scph1001.bin)"]);
    expect(BiosService.installBios).toHaveBeenCalled();
  });

  it("installs a BIOS directory in place, without staging it", async () => {
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([
      biosScan({ consoleId: "3ds", engineId: "azahar", filePath: "/drop/user" }),
    ]);

    await ImportService.importPath("/drop/user", notify);

    expect(Extractor.extractToFile).not.toHaveBeenCalled();
    expect(BiosService.installBios).toHaveBeenCalledWith("3ds", "/drop/user");
  });

  it("stages an archived BIOS entry and cleans up afterwards", async () => {
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([
      biosScan({ filePath: "/drop/bios.zip", zipEntryName: "roms/scph5500.bin" }),
    ]);

    const result = await ImportService.importPath("/drop/bios.zip", notify);

    expect(result.biosLabels).toEqual(["PS1 BIOS (scph5500.bin)"]);
    expect(Extractor.extractToFile).toHaveBeenCalled();
    expect(fs.rmSync).toHaveBeenCalled();
  });

  it("cleans up the staging directory even when the install throws", async () => {
    (BiosService.installBios as jest.Mock).mockRejectedValueOnce(new Error("bad bios"));
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([biosScan()]);

    const result = await ImportService.importPath("/drop/scph1001.bin", notify);

    expect(result.success).toBe(false);
    expect(result.message).toBe("bad bios");
    expect(fs.rmSync).toHaveBeenCalled();
  });

  describe("engine auto-install", () => {
    it("skips the install when the engine is already present", async () => {
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([gameScan()]);

      await ImportService.importPath("/drop/Test Game.nes", notify);

      expect(EngineService.installEngine).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });

    it("installs a missing engine for a dropped game", async () => {
      (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([gameScan()]);

      await ImportService.importPath("/drop/Test Game.nes", notify);

      expect(EngineService.installEngine).toHaveBeenCalledWith("mesen", expect.any(Function));
      expect(notify).toHaveBeenCalledWith("Installing emulator…");
    });

    it("installs a missing engine for a dropped BIOS too", async () => {
      (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([biosScan()]);

      await ImportService.importPath("/drop/scph1001.bin", notify);

      expect(EngineService.installEngine).toHaveBeenCalledWith("duckstation", expect.any(Function));
    });

    it("honours the auto-install setting being off", async () => {
      autoInstallSetting = false;
      (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([gameScan()]);

      await ImportService.importPath("/drop/Test Game.nes", notify);

      expect(EngineService.installEngine).not.toHaveBeenCalled();
    });

    it("signals completion even when the install fails, so the banner clears", async () => {
      (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);
      (EngineService.installEngine as jest.Mock).mockRejectedValue(new Error("network down"));
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([gameScan()]);

      await ImportService.importPath("/drop/Test Game.nes", notify);
      await new Promise((resolve) => setImmediate(resolve));

      expect(notify).toHaveBeenCalledWith("complete");
    });

    it("does not fail the import when the engine install fails", async () => {
      (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);
      (EngineService.installEngine as jest.Mock).mockRejectedValue(new Error("network down"));
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([gameScan()]);

      const result = await ImportService.importPath("/drop/Test Game.nes", notify);
      await new Promise((resolve) => setImmediate(resolve));

      expect(result.success).toBe(true);
      expect(result.games).toEqual([game]);
    });
  });

  describe("nothing recognized", () => {
    it("explains an archive that held nothing usable", async () => {
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([]);

      const result = await ImportService.importPath("/drop/random.zip", notify);

      expect(result).toMatchObject({
        success: false,
        nothingRecognized: true,
        fileExtension: ".zip",
      });
      expect(result.message).toContain("No supported games or BIOS files found");
    });

    it("names the unknown extension for a plain file", async () => {
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([]);

      const result = await ImportService.importPath("/drop/notes.txt", notify);
      expect(result.message).toBe("Unknown extension .txt");
    });

    it("handles a file with no extension at all", async () => {
      (ScannerService.scanPath as jest.Mock).mockResolvedValue([]);

      const result = await ImportService.importPath("/drop/README", notify);
      expect(result.message).toBe("Unknown extension (none)");
    });
  });

  it("reports a scan failure rather than throwing", async () => {
    (ScannerService.scanPath as jest.Mock).mockRejectedValue(new Error("unreadable"));

    const result = await ImportService.importPath("/drop/broken", notify);

    expect(result).toMatchObject({ success: false, message: "unreadable", games: [] });
  });
});
