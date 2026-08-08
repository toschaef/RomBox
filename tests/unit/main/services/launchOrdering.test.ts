// the rom check used to run after configurators had already rewritten the
// emulator ini files. validation now happens first.
import fs from "fs";
import { LaunchService } from "../../../../src/main/services/LaunchService";
import { EngineService } from "../../../../src/main/services/EngineService";
import { BiosService } from "../../../../src/main/services/BiosService";
import { SaveService } from "../../../../src/main/services/SaveService";
import { LibraryService } from "../../../../src/main/services/LibraryService";
import { getConfigurator } from "../../../../src/main/emulators";
import { osHandler } from "../../../../src/main/platform";
import type { Game } from "../../../../src/shared/types";

jest.mock("../../../../src/main/services/EngineService", () => ({
  EngineService: { getEnginePath: jest.fn(), isEngineInstalling: jest.fn() },
}));

jest.mock("../../../../src/main/services/BiosService", () => ({
  BiosService: {
    getGameBiosStatus: jest.fn(),
    ensureBiosInstalledFromCache: jest.fn(),
  },
}));

jest.mock("../../../../src/main/services/SaveService", () => ({
  SaveService: {
    restoreSave: jest.fn().mockReturnValue({ restoredFiles: [] }),
    backupSave: jest.fn().mockReturnValue({ backedUpFiles: [] }),
  },
}));

jest.mock("../../../../src/main/services/LibraryService", () => ({
  LibraryService: { updateLastPlayed: jest.fn(), addPlaytime: jest.fn() },
}));

jest.mock("../../../../src/main/services/SettingsService", () => ({
  settingsService: { get: jest.fn().mockReturnValue(false) },
}));

jest.mock("../../../../src/main/platform", () => ({
  osHandler: { launchProcess: jest.fn() },
}));

jest.mock("../../../../src/main/emulators", () => ({
  getConfigurator: jest.fn(),
}));

jest.mock("electron", () => ({
  app: { getPath: jest.fn().mockReturnValue("/mock/userData") },
  BrowserWindow: { getAllWindows: jest.fn().mockReturnValue([]) },
}));

const game: Game = {
  id: "game-1",
  title: "Test Game",
  filePath: "/roms/nes/Test Game.nes",
  consoleId: "nes",
  engineId: "mesen",
  playtimeSeconds: 0,
  lastPlayedAt: null,
} as Game;

describe("launch ordering", () => {
  let configure: jest.Mock;
  let child: { on: jest.Mock; unref: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    configure = jest.fn().mockResolvedValue(undefined);
    (getConfigurator as jest.Mock).mockReturnValue({ configure });

    child = { on: jest.fn(), unref: jest.fn() };
    (osHandler.launchProcess as jest.Mock).mockReturnValue(child);

    (EngineService.getEnginePath as jest.Mock).mockResolvedValue("/engines/mesen/Mesen");
    (BiosService.getGameBiosStatus as jest.Mock).mockReturnValue({
      needsBios: false,
      biosState: "none",
      missingRequiredFiles: [],
    });
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not configure the emulator when the ROM is missing", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const result = await LaunchService.launch(game);

    expect(result).toMatchObject({ success: false, code: "MISSING_FILE" });
    expect(configure).not.toHaveBeenCalled();
    expect(SaveService.restoreSave).not.toHaveBeenCalled();
    expect(osHandler.launchProcess).not.toHaveBeenCalled();
  });

  it("does not configure or restore when the engine is missing", async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);
    (EngineService.isEngineInstalling as jest.Mock).mockReturnValue(false);

    const result = await LaunchService.launch(game);

    expect(result).toMatchObject({ success: false, code: "MISSING_ENGINE" });
    expect(configure).not.toHaveBeenCalled();
    expect(SaveService.restoreSave).not.toHaveBeenCalled();
  });

  it("reports an in-progress install separately from a missing one", async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);
    (EngineService.isEngineInstalling as jest.Mock).mockReturnValue(true);

    const result = await LaunchService.launch(game);
    expect(result).toMatchObject({ success: false, code: "ENGINE_INSTALLING" });
  });

  it("does not configure when required BIOS is still missing after the cache check", async () => {
    (BiosService.getGameBiosStatus as jest.Mock).mockReturnValue({
      needsBios: true,
      biosState: "missing",
      missingRequiredFiles: ["scph1001.bin"],
    });

    const result = await LaunchService.launch(game);

    expect(result).toMatchObject({ success: false, code: "MISSING_BIOS" });
    expect(BiosService.ensureBiosInstalledFromCache).toHaveBeenCalledWith("nes");
    expect(configure).not.toHaveBeenCalled();
  });

  it("restores saves before configuring, and configures before spawning", async () => {
    const order: string[] = [];
    (SaveService.restoreSave as jest.Mock).mockImplementation(() => {
      order.push("restore");
      return { restoredFiles: [] };
    });
    configure.mockImplementation(async () => {
      order.push("configure");
    });
    (osHandler.launchProcess as jest.Mock).mockImplementation(() => {
      order.push("spawn");
      return child;
    });

    await LaunchService.launch(game);

    expect(order).toEqual(["restore", "configure", "spawn"]);
  });

  it("marks the game played only after the process starts", async () => {
    (osHandler.launchProcess as jest.Mock).mockImplementation(() => {
      expect(LibraryService.updateLastPlayed).not.toHaveBeenCalled();
      return child;
    });

    await LaunchService.launch(game);

    expect(LibraryService.updateLastPlayed).toHaveBeenCalledWith("game-1");
  });

  it("does not mark the game played when spawning throws", async () => {
    (osHandler.launchProcess as jest.Mock).mockImplementation(() => {
      throw new Error("spawn failed");
    });

    const result = await LaunchService.launch(game);

    expect(result).toMatchObject({ success: false, message: "spawn failed" });
    expect(LibraryService.updateLastPlayed).not.toHaveBeenCalled();
  });

  it("still launches when configuration fails, but reports the failure", async () => {
    // a broken config used to be swallowed into a log line, so the game would
    // silently start with stale controls.
    configure.mockRejectedValue(new Error("could not write GCPadNew.ini"));

    const result = await LaunchService.launch(game);

    expect(result.success).toBe(true);
    expect(result.configWarning).toBe("could not write GCPadNew.ini");
    expect(osHandler.launchProcess).toHaveBeenCalled();
  });

  it("launches cleanly when there is no configurator for the engine", async () => {
    (getConfigurator as jest.Mock).mockReturnValue(null);

    const result = await LaunchService.launch(game);

    expect(result).toEqual({ success: true, configWarning: undefined });
    expect(osHandler.launchProcess).toHaveBeenCalled();
  });
});
