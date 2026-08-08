import { WinHandler } from "../../../../src/main/platform/WinHandler";
import type { Game } from "../../../../src/shared/types";
import type { EngineID } from "../../../../src/shared/types/engines";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Extractor } from "../../../../src/main/utils/extractor";

jest.mock("child_process", () => ({
  spawn: jest.fn()
}));

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    existsSync: jest.fn((p: fs.PathLike) => actual.existsSync(p)),
    promises: {
      ...actual.promises,
      rm: jest.fn().mockResolvedValue(undefined),
      copyFile: jest.fn().mockResolvedValue(undefined)
    }
  };
});

jest.mock("os", () => ({
  ...jest.requireActual("os"),
  homedir: () => "C:\\Users\\TestUser"
}));

jest.mock("../../../../src/main/utils/extractor", () => ({
  Extractor: {
    extractArchive: jest.fn().mockResolvedValue(undefined)
  }
}));

describe("WinHandler", () => {
  let handler: WinHandler;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.USERPROFILE;
    delete process.env.HOME;
    delete process.env.APPDATA;
    delete process.env.LOCALAPPDATA;
    handler = new WinHandler();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getPlatformId & getPlatform", () => {
    it("should return 'windows' and 'win32'", () => {
      expect(handler.getPlatformId()).toBe("windows");
      expect(handler.getPlatform()).toBe("win32");
    });
  });

  describe("getEmulatorConfigPath", () => {
    it("should return correct path for dolphin", () => {
      const expected = path.join("C:\\Users\\TestUser", "AppData", "Roaming", "Dolphin Emulator", "Config");
      expect(handler.getEmulatorConfigPath("dolphin")).toBe(expected);
    });

    it("should return correct path for mesen", () => {
      expect(handler.getEmulatorConfigPath("mesen")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "Mesen2")
      );
    });

    it("should return correct path for ares", () => {
      expect(handler.getEmulatorConfigPath("ares")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Local", "ares")
      );
    });

    it("should return correct path for melonds", () => {
      expect(handler.getEmulatorConfigPath("melonds")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Local", "melonDS")
      );
    });

    it("should return correct path for azahar", () => {
      expect(handler.getEmulatorConfigPath("azahar")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Roaming", "Azahar", "config")
      );
    });

    it("should return correct path for pcsx2", () => {
      expect(handler.getEmulatorConfigPath("pcsx2")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "PCSX2", "inis")
      );
    });

    it("should return correct path for duckstation", () => {
      expect(handler.getEmulatorConfigPath("duckstation")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "DuckStation")
      );
    });

    it("should throw for unsupported engines", () => {
      expect(() => handler.getEmulatorConfigPath("unsupported" as EngineID)).toThrow(
        "Unknown emulator: unsupported"
      );
    });
  });

  describe("getEmulatorBasePath", () => {
    it("should return correct base path for dolphin", () => {
      expect(handler.getEmulatorBasePath("dolphin")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Roaming", "Dolphin Emulator")
      );
    });

    it("should return correct base path for mesen", () => {
      expect(handler.getEmulatorBasePath("mesen")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "Mesen2")
      );
    });

    it("should return correct base path for ares", () => {
      expect(handler.getEmulatorBasePath("ares")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Local", "ares")
      );
    });

    it("should return correct base path for melonds", () => {
      expect(handler.getEmulatorBasePath("melonds")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Local", "melonDS")
      );
    });

    it("should return correct base path for azahar", () => {
      expect(handler.getEmulatorBasePath("azahar")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Roaming", "Azahar")
      );
    });

    it("should return correct base path for pcsx2", () => {
      expect(handler.getEmulatorBasePath("pcsx2")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "PCSX2")
      );
    });

    it("should return correct base path for duckstation", () => {
      expect(handler.getEmulatorBasePath("duckstation")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "DuckStation")
      );
    });

    it("should throw for unsupported engines", () => {
      expect(() => handler.getEmulatorBasePath("unsupported" as EngineID)).toThrow(
        "Unknown emulator: unsupported"
      );
    });
  });

  describe("getSavePath", () => {
    it("should return correct save path for mesen", () => {
      const game = { engineId: "mesen", filePath: "C:/roms/game.nes" } as Game;
      expect(handler.getSavePath(game)).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "Mesen2", "Saves")
      );
    });

    it("should return dirname for melonds", () => {
      const game = { engineId: "melonds", filePath: "/roms/ds/game.nds" } as Game;
      expect(handler.getSavePath(game)).toBe(path.dirname("/roms/ds/game.nds"));
    });

    it("should return Wii path for dolphin when consoleId is wii", () => {
      const game = { engineId: "dolphin", consoleId: "wii" } as Game;
      expect(handler.getSavePath(game)).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Roaming", "Dolphin Emulator", "Wii")
      );
    });

    it("should return GC path for dolphin when consoleId is gc", () => {
      const game = { engineId: "dolphin", consoleId: "gc" } as Game;
      expect(handler.getSavePath(game)).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Roaming", "Dolphin Emulator", "GC")
      );
    });

    it("should return correct path for azahar", () => {
      const game = { engineId: "azahar" } as Game;
      expect(handler.getSavePath(game)).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Roaming", "Azahar", "sdmc")
      );
    });

    it("should return the ROM directory for ares, which saves next to the ROM", () => {
      const game = { engineId: "ares", filePath: path.join("C:\\roms", "n64", "Mario Kart 64.z64") } as Game;
      expect(handler.getSavePath(game)).toBe(path.join("C:\\roms", "n64"));
    });

    it("should return correct path for duckstation", () => {
      const game = { engineId: "duckstation" } as Game;
      expect(handler.getSavePath(game)).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "DuckStation", "memcards")
      );
    });

    it("should return correct path for pcsx2", () => {
      const game = { engineId: "pcsx2" } as Game;
      expect(handler.getSavePath(game)).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "PCSX2", "memcards")
      );
    });

    it("should throw for unknown engineId", () => {
      const game = { engineId: "unknown" as EngineID } as Game;
      expect(() => handler.getSavePath(game)).toThrow("Unknown emulator: unknown");
    });
  });

  describe("getBiosPath", () => {
    // these are the directories BIOS files actually install into (see
    // config/consoles.ts). The removed getBiosDir() disagreed for mesen and
    // azahar and invented directories for Dolphin and ares, which need none;
    // it was never called outside these tests.
    it("puts Mesen firmware under its Documents profile", () => {
      expect(handler.getBiosPath("mesen")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "Mesen2", "Firmware")
      );
    });

    it("puts melonDS firmware in its base directory", () => {
      expect(handler.getBiosPath("melonds")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Local", "melonDS")
      );
    });

    it("puts Azahar system data in its base directory", () => {
      expect(handler.getBiosPath("azahar")).toBe(
        path.join("C:\\Users\\TestUser", "AppData", "Roaming", "Azahar")
      );
    });

    it("puts PlayStation BIOSes in a bios subdirectory", () => {
      expect(handler.getBiosPath("pcsx2")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "PCSX2", "bios")
      );
      expect(handler.getBiosPath("duckstation")).toBe(
        path.join("C:\\Users\\TestUser", "Documents", "DuckStation", "bios")
      );
    });

    it("returns null for emulators that need no BIOS", () => {
      expect(handler.getBiosPath("dolphin")).toBeNull();
      expect(handler.getBiosPath("ares")).toBeNull();
    });

    it("should throw for unsupported engines", () => {
      expect(() => handler.getBiosPath("unsupported" as EngineID)).toThrow(
        "Unknown emulator: unsupported"
      );
    });
  });

  describe("resolveWinPath", () => {
    it("should substitute environment variable tokens in path string", () => {
      process.env.APPDATA = "C:\\Users\\TestUser\\AppData\\Roaming";
      process.env.LOCALAPPDATA = "C:\\Users\\TestUser\\AppData\\Local";
      process.env.USERPROFILE = "C:\\Users\\TestUser";

      const input = "%APPDATA%\\test;%LOCALAPPDATA%\\test;%USERPROFILE%\\test";
      const resolved = handler.resolveWinPath(input);
      expect(resolved).toBe("C:\\Users\\TestUser\\AppData\\Roaming\\test;C:\\Users\\TestUser\\AppData\\Local\\test;C:\\Users\\TestUser\\test");
    });
  });

  describe("launchProcess", () => {
    it("should spawn process with default cwd if not specified in options", () => {
      handler.launchProcess("C:\\emulators\\dolphin.exe", ["--batch"]);

      expect(spawn).toHaveBeenCalledWith(
        "C:\\emulators\\dolphin.exe",
        ["--batch"],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          cwd: "C:\\emulators"
        }
      );
    });

    it("should spawn process with custom cwd if specified in options", () => {
      handler.launchProcess("C:\\emulators\\dolphin.exe", ["--batch"], { cwd: "C:\\custom\\dir" });

      expect(spawn).toHaveBeenCalledWith(
        "C:\\emulators\\dolphin.exe",
        ["--batch"],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          cwd: "C:\\custom\\dir"
        }
      );
    });
  });

  describe("clearPlatformData", () => {
    it("should remove existing directories for Windows platform data", async () => {
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
        return p.includes("Mesen2") || p.includes("ares");
      });

      await handler.clearPlatformData();

      // Mesen's Windows profile lives under Documents, which is what
      // getEmulatorBasePath returns. The previous hardcoded cleanup list named
      // appData/Roaming/Mesen2 and so never cleaned Mesen at all.
      expect(fs.promises.rm).toHaveBeenCalledWith(
        path.join("C:\\Users\\TestUser", "Documents", "Mesen2"),
        { recursive: true, force: true }
      );
      expect(fs.promises.rm).toHaveBeenCalledWith(
        path.join("C:\\Users\\TestUser", "AppData", "Local", "ares"),
        { recursive: true, force: true }
      );
    });
  });

  describe("extractArchive", () => {
    it("should delegate to Extractor.extractArchive", async () => {
      await handler.extractArchive("C:\\archive.zip", "C:\\dest");
      expect(Extractor.extractArchive).toHaveBeenCalledWith("C:\\archive.zip", "C:\\dest");
    });
  });

  describe("installDependency", () => {
    it("should copy file to target directory", async () => {
      await handler.installDependency("C:\\src\\dep.dll", "C:\\target", "dep", "target.dll");
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        "C:\\src\\dep.dll",
        path.join("C:\\target", "target.dll")
      );
    });
  });

  describe("finalizeInstall", () => {
    it("should do nothing if binaryPath does not exist", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await handler.finalizeInstall("C:\\bin.exe", false);
      expect(fs.existsSync).toHaveBeenCalledWith("C:\\bin.exe");
    });

    it("should execute finalize logging if binaryPath exists", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      await handler.finalizeInstall("C:\\bin.exe", false);
      expect(fs.existsSync).toHaveBeenCalledWith("C:\\bin.exe");
    });
  });
});
