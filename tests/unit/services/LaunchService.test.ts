import fs from "fs";
import { LaunchService } from "../../../src/main/services/LaunchService";
import { EngineService } from "../../../src/main/services/EngineService";
import { BiosService } from "../../../src/main/services/BiosService";
import { LibraryService } from "../../../src/main/services/LibraryService";
import { osHandler } from "../../../src/main/platform";
import type { Game } from "../../../src/shared/types";
import { initDB } from "../../../src/main/data/db";

jest.mock("../../../src/main/services/EngineService", () => ({
  EngineService: {
    getEnginePath: jest.fn(),
    isEngineInstalling: jest.fn()
  }
}));

jest.mock("../../../src/main/services/BiosService", () => ({
  BiosService: {
    getGameBiosStatus: jest.fn(),
    ensureBiosInstalledFromCache: jest.fn()
  }
}));

jest.mock("../../../src/main/services/SaveService", () => ({
  SaveService: {
    restoreSave: jest.fn().mockReturnValue({ restoredFiles: [] }),
    backupSave: jest.fn().mockReturnValue({ backedUpFiles: [] })
  }
}));

jest.mock("../../../src/main/services/LibraryService", () => ({
  LibraryService: {
    updateLastPlayed: jest.fn(),
    addPlaytime: jest.fn()
  }
}));

jest.mock("../../../src/main/platform", () => ({
  osHandler: {
    launchProcess: jest.fn()
  }
}));

jest.mock("../../../src/main/utils/configurators", () => ({
  getConfigurator: jest.fn().mockReturnValue({
    configure: jest.fn().mockResolvedValue(true)
  })
}));

jest.mock("electron", () => ({
  app: {
    getPath: jest.fn().mockReturnValue("/mock/userData")
  },
  BrowserWindow: {
    getAllWindows: jest.fn().mockReturnValue([])
  }
}));

describe("LaunchService", () => {
  const mockGame: Game = {
    id: "mario-bros",
    title: "Super Mario Bros.",
    filePath: "/roms/smb.nes",
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: 0
  };

  const mockChildProcess = {
    on: jest.fn(),
    unref: jest.fn()
  };

  let existsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (EngineService.isEngineInstalling as jest.Mock).mockReturnValue(false);
    existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    initDB();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should fail launch if engine is not installed", async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);

    const result = await LaunchService.launch(mockGame);
    expect(result.success).toBe(false);
    expect(result.code).toBe("MISSING_ENGINE");
  });

  it("should fail launch with ENGINE_INSTALLING if engine is currently installing", async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);
    (EngineService.isEngineInstalling as jest.Mock).mockReturnValue(true);

    const result = await LaunchService.launch(mockGame);
    expect(result.success).toBe(false);
    expect(result.code).toBe("ENGINE_INSTALLING");
    expect(result.message).toContain("currently installing");
  });

  it("should fail launch if game file does not exist", async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue("/path/to/mesen");
    (BiosService.getGameBiosStatus as jest.Mock).mockReturnValue({ needsBios: false });
    existsSpy.mockReturnValue(false); // Game file missing

    const result = await LaunchService.launch(mockGame);
    expect(result.success).toBe(false);
    expect(result.code).toBe("MISSING_FILE");
  });

  it("should fail launch if required BIOS is missing", async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue("/path/to/mesen");
    (BiosService.getGameBiosStatus as jest.Mock).mockReturnValue({
      needsBios: true,
      biosState: "missing",
      missingRequiredFiles: ["bios.bin"]
    });

    const result = await LaunchService.launch(mockGame);
    expect(result.success).toBe(false);
    expect(result.code).toBe("MISSING_BIOS");
  });

  it("should launch emulator process successfully under normal conditions", async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue("/path/to/mesen");
    (BiosService.getGameBiosStatus as jest.Mock).mockReturnValue({ needsBios: false });
    (osHandler.launchProcess as jest.Mock).mockReturnValue(mockChildProcess);

    const result = await LaunchService.launch(mockGame);
    expect(result.success).toBe(true);
    expect(osHandler.launchProcess).toHaveBeenCalledWith(
      "/path/to/mesen",
      ["/roms/smb.nes"]
    );
    expect(LibraryService.updateLastPlayed).toHaveBeenCalledWith("mario-bros");
  });
});
