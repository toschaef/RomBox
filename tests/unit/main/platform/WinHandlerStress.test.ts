import { WinHandler } from "../../../../src/main/platform/WinHandler";
import type { Game } from "../../../../src/shared/types";
import type { EngineID } from "../../../../src/shared/types/engines";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

jest.mock("child_process", () => ({
  spawn: jest.fn().mockReturnValue({ pid: 1234, on: jest.fn() })
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
  homedir: () => "C:\\Users\\DefaultFallbackUser"
}));

describe("M3 Empirical Stress Test - WinHandler Edge Cases", () => {
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

  describe("1. Environment Variables and Path Fallbacks", () => {
    it("should fallback to homedir when USERPROFILE and HOME are completely missing", () => {
      const configPath = handler.getEmulatorConfigPath("dolphin");
      expect(configPath).toBe(
        path.win32.join("C:\\Users\\DefaultFallbackUser", "AppData", "Roaming", "Dolphin Emulator", "Config")
      );
    });

    it("should respect USERPROFILE over HOME and homedir()", () => {
      process.env.USERPROFILE = "D:\\Users\\CustomUserProfile";
      process.env.HOME = "E:\\Users\\CustomHome";

      const configPath = handler.getEmulatorConfigPath("dolphin");
      expect(configPath).toBe(
        path.win32.join("D:\\Users\\CustomUserProfile", "AppData", "Roaming", "Dolphin Emulator", "Config")
      );
    });

    it("should respect HOME if USERPROFILE is undefined", () => {
      process.env.HOME = "E:\\Users\\CustomHome";

      const configPath = handler.getEmulatorConfigPath("dolphin");
      expect(configPath).toBe(
        path.win32.join("E:\\Users\\CustomHome", "AppData", "Roaming", "Dolphin Emulator", "Config")
      );
    });

    it("should respect custom APPDATA and LOCALAPPDATA environment variables", () => {
      process.env.APPDATA = "X:\\CustomAppData\\Roaming";
      process.env.LOCALAPPDATA = "Y:\\CustomAppData\\Local";

      expect(handler.getEmulatorConfigPath("dolphin")).toBe(
        path.win32.join("X:\\CustomAppData\\Roaming", "Dolphin Emulator", "Config")
      );
      expect(handler.getEmulatorConfigPath("ares")).toBe(
        path.win32.join("Y:\\CustomAppData\\Local", "ares")
      );
    });

    it("should handle custom paths containing spaces and special characters in APPDATA and LOCALAPPDATA", () => {
      process.env.APPDATA = "C:\\Users\\José & María\\App Data (Roaming)";
      process.env.LOCALAPPDATA = "C:\\Users\\José & María\\App Data (Local)";

      expect(handler.getEmulatorConfigPath("azahar")).toBe(
        path.win32.join("C:\\Users\\José & María\\App Data (Roaming)", "Azahar", "config")
      );
      expect(handler.getEmulatorConfigPath("melonds")).toBe(
        path.win32.join("C:\\Users\\José & María\\App Data (Local)", "melonDS")
      );
    });
  });

  describe("2. resolveWinPath Token Expansion & Edge Cases", () => {
    it("should handle case-insensitive variable tokens (%appdata%, %LocalAppData%, %userprofile%)", () => {
      process.env.APPDATA = "C:\\Roaming";
      process.env.LOCALAPPDATA = "C:\\Local";
      process.env.USERPROFILE = "C:\\User";

      const input = "%appdata%\\folder;%LocalAppdata%\\folder;%userprofile%\\folder";
      const resolved = handler.resolveWinPath(input);
      expect(resolved).toBe("C:\\Roaming\\folder;C:\\Local\\folder;C:\\User\\folder");
    });

    it("should handle paths with multiple occurrences of the same token", () => {
      process.env.APPDATA = "C:\\AppData";

      const input = "%APPDATA%\\a\\%APPDATA%\\b";
      expect(handler.resolveWinPath(input)).toBe("C:\\AppData\\a\\C:\\AppData\\b");
    });

    it("should handle empty strings and strings without tokens unchanged", () => {
      expect(handler.resolveWinPath("")).toBe("");
      expect(handler.resolveWinPath("C:\\Plain\\Path\\File.txt")).toBe("C:\\Plain\\Path\\File.txt");
    });
  });

  describe("3. Engine ID Validation and Unsupported Engine Handling", () => {
    const invalidEngines = ["invalid_engine", "", "unknown", "null"] as unknown as EngineID[];

    invalidEngines.forEach((engineId) => {
      it(`should throw error for invalid engine ID '${engineId}' in getEmulatorConfigPath`, () => {
        expect(() => handler.getEmulatorConfigPath(engineId)).toThrow(`Unknown emulator: ${engineId}`);
      });

      it(`should throw error for invalid engine ID '${engineId}' in getEmulatorBasePath`, () => {
        expect(() => handler.getEmulatorBasePath(engineId)).toThrow(`Unknown emulator: ${engineId}`);
      });

      it(`should throw error for invalid engine ID '${engineId}' in getBiosPath`, () => {
        expect(() => handler.getBiosPath(engineId)).toThrow(`Unknown emulator: ${engineId}`);
      });

      it(`should throw error for invalid engine ID '${engineId}' in getSavePath`, () => {
        const game = { engineId } as Game;
        expect(() => handler.getSavePath(game)).toThrow(`Unknown emulator: ${engineId}`);
      });
    });
  });

  describe("4. launchProcess Execution & CWD Resolution Edge Cases", () => {
    it("should correctly derive cwd for Windows paths with backslashes", () => {
      handler.launchProcess("C:\\Games\\Emulators\\Dolphin\\dolphin.exe", ["-b"]);
      expect(spawn).toHaveBeenCalledWith(
        "C:\\Games\\Emulators\\Dolphin\\dolphin.exe",
        ["-b"],
        expect.objectContaining({
          cwd: "C:\\Games\\Emulators\\Dolphin"
        })
      );
    });

    it("should correctly handle Windows paths with forward slashes", () => {
      handler.launchProcess("C:/Games/Emulators/Dolphin/dolphin.exe", ["-b"]);
      expect(spawn).toHaveBeenCalledWith(
        "C:/Games/Emulators/Dolphin/dolphin.exe",
        ["-b"],
        expect.objectContaining({
          cwd: expect.any(String)
        })
      );
    });

    it("should prioritize explicit cwd in options over derived path", () => {
      handler.launchProcess("C:\\dolphin\\dolphin.exe", [], { cwd: "D:\\CustomCwd" });
      expect(spawn).toHaveBeenCalledWith(
        "C:\\dolphin\\dolphin.exe",
        [],
        expect.objectContaining({ cwd: "D:\\CustomCwd" })
      );
    });

    it("should pass args intact even with empty strings or special characters", () => {
      const complexArgs = ["--exec", "C:\\Roms\\Game with space.iso", "-u", ""];
      handler.launchProcess("C:\\dolphin\\dolphin.exe", complexArgs);
      expect(spawn).toHaveBeenCalledWith(
        "C:\\dolphin\\dolphin.exe",
        complexArgs,
        expect.any(Object)
      );
    });
  });

  describe("5. clearPlatformData and File Operations Resilience", () => {
    it("should clean the base directory of every registered emulator", async () => {
      process.env.APPDATA = "C:\\AppData\\Roaming";
      process.env.LOCALAPPDATA = "C:\\AppData\\Local";
      process.env.USERPROFILE = "C:\\Users\\Test";

      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await handler.clearPlatformData();

      // one directory per emulator, taken from the same registry that
      // getEmulatorBasePath uses. The previous hardcoded list held 9 entries
      // for 7 emulators because it guessed at two alternate locations
      // (AppData/Mesen2 and Documents/Dolphin Emulator) that no emulator
      // actually uses, and would silently miss any emulator added later.
      const expected = [
        path.win32.join("C:\\Users\\Test", "Documents", "Mesen2"),
        path.win32.join("C:\\AppData\\Local", "melonDS"),
        path.win32.join("C:\\AppData\\Roaming", "Azahar"),
        path.win32.join("C:\\AppData\\Roaming", "Dolphin Emulator"),
        path.win32.join("C:\\AppData\\Local", "ares"),
        path.win32.join("C:\\Users\\Test", "Documents", "DuckStation"),
        path.win32.join("C:\\Users\\Test", "Documents", "PCSX2"),
      ];

      expect(fs.promises.rm).toHaveBeenCalledTimes(expected.length);
      for (const dir of expected) {
        expect(fs.promises.rm).toHaveBeenCalledWith(dir, { recursive: true, force: true });
      }
    });

    it("should skip paths that do not exist during clearPlatformData", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await handler.clearPlatformData();
      expect(fs.promises.rm).not.toHaveBeenCalled();
    });
  });
});
