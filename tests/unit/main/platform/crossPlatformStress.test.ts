import { WinHandler } from "../../../../src/main/platform/WinHandler";
import type { Game } from "../../../../src/shared/types";
import type { EngineID } from "../../../../src/shared/types/engines";
import { spawn } from "child_process";
import path from "path";
import os from "os";

jest.mock("child_process", () => ({
  ...jest.requireActual("child_process"),
  spawn: jest.fn()
}));

describe("Milestone 3 Empirical Stress Test Harness - Platform Logic & WinHandler", () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    jest.resetModules();
  });

  describe("Platform Factory (index.ts) Robustness & Unsupported OS Behavior", () => {
    const invalidPlatforms = [
      "linux",
      "freebsd",
      "sunos",
      "aix",
      "android",
      "",
      "WIN32",
      "DARWIN",
      "win32 ",
      "darwin\n"
    ];

    invalidPlatforms.forEach((invalidPlat) => {
      it(`should throw Unsupported OS error for platform string: "${invalidPlat}"`, () => {
        Object.defineProperty(process, "platform", {
          value: invalidPlat,
          configurable: true,
        });
        jest.resetModules();
        expect(() => {
          require("../../../../src/main/platform");
        }).toThrow(`Unsupported OS: ${invalidPlat}`);
      });
    });

    it("should handle rapid platform switching without state corruption", () => {
      for (let i = 0; i < 10; i++) {
        const targetPlat = i % 2 === 0 ? "win32" : "darwin";
        Object.defineProperty(process, "platform", {
          value: targetPlat,
          configurable: true,
        });
        jest.resetModules();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { osHandler } = require("../../../../src/main/platform");
        expect(osHandler.getPlatform()).toBe(targetPlat);
        expect(osHandler.getPlatformId()).toBe(targetPlat === "win32" ? "windows" : "macos");
      }
    });
  });

  describe("WinHandler - Environmental Failure Fallbacks", () => {
    it("should fallback to os.homedir() when USERPROFILE, HOME, APPDATA, LOCALAPPDATA are undefined", () => {
      delete process.env.USERPROFILE;
      delete process.env.HOME;
      delete process.env.APPDATA;
      delete process.env.LOCALAPPDATA;

      const handler = new WinHandler();
      const actualHomedir = os.homedir();

      const expectedConfig = path.win32.join(actualHomedir, "AppData", "Roaming", "Dolphin Emulator", "Config");
      expect(handler.getEmulatorConfigPath("dolphin")).toBe(expectedConfig);

      const expectedAres = path.win32.join(actualHomedir, "AppData", "Local", "ares");
      expect(handler.getEmulatorConfigPath("ares")).toBe(expectedAres);
    });

    it("should prioritize USERPROFILE over HOME over os.homedir()", () => {
      process.env.USERPROFILE = "C:\\UserProfile";
      process.env.HOME = "C:\\HomeDir";
      delete process.env.APPDATA;
      delete process.env.LOCALAPPDATA;

      const handler = new WinHandler();
      expect(handler.getEmulatorConfigPath("dolphin")).toBe(
        path.win32.join("C:\\UserProfile", "AppData", "Roaming", "Dolphin Emulator", "Config")
      );

      delete process.env.USERPROFILE;
      expect(handler.getEmulatorConfigPath("dolphin")).toBe(
        path.win32.join("C:\\HomeDir", "AppData", "Roaming", "Dolphin Emulator", "Config")
      );
    });
  });

  describe("WinHandler - Path Resolution (%APPDATA%, %LOCALAPPDATA%, %USERPROFILE%)", () => {
    it("should handle empty strings and strings with no environment tokens", () => {
      const handler = new WinHandler();
      expect(handler.resolveWinPath("")).toBe("");
      expect(handler.resolveWinPath("C:\\Program Files\\Test")).toBe("C:\\Program Files\\Test");
    });

    it("should handle multiple and repeated tokens in path string case-insensitively", () => {
      process.env.USERPROFILE = "C:\\User";
      process.env.APPDATA = "C:\\User\\AppData\\Roaming";
      process.env.LOCALAPPDATA = "C:\\User\\AppData\\Local";

      const handler = new WinHandler();
      const input = "%appdata%\\sub1;%APPDATA%\\sub2;%localappdata%\\sub3;%userprofile%\\sub4";
      const expected = "C:\\User\\AppData\\Roaming\\sub1;C:\\User\\AppData\\Roaming\\sub2;C:\\User\\AppData\\Local\\sub3;C:\\User\\sub4";
      expect(handler.resolveWinPath(input)).toBe(expected);
    });

    it("should leave unknown env tokens untouched", () => {
      const handler = new WinHandler();
      expect(handler.resolveWinPath("%UNKNOWN_VAR%\\test")).toBe("%UNKNOWN_VAR%\\test");
    });
  });

  describe("WinHandler - Process Launching Edge Cases", () => {
    it("should compute cwd correctly when binary path has forward slashes vs backslashes", () => {
      const handler = new WinHandler();
      handler.launchProcess("C:/emulators/dolphin/dolphin.exe", ["--batch"]);
      expect(spawn).toHaveBeenLastCalledWith(
        "C:/emulators/dolphin/dolphin.exe",
        ["--batch"],
        expect.objectContaining({ cwd: "C:/emulators/dolphin" })
      );

      handler.launchProcess("C:\\emulators\\ares\\ares.exe", []);
      expect(spawn).toHaveBeenLastCalledWith(
        "C:\\emulators\\ares\\ares.exe",
        [],
        expect.objectContaining({ cwd: "C:\\emulators\\ares" })
      );
    });

    it("should fallback dirname when binaryPath has no slash", () => {
      const handler = new WinHandler();
      handler.launchProcess("dolphin.exe", []);
      expect(spawn).toHaveBeenLastCalledWith(
        "dolphin.exe",
        [],
        expect.objectContaining({ cwd: "." })
      );
    });
  });

  describe("WinHandler - Engine Path Error Boundaries", () => {
    const invalidEngines = ["unknown", "", "retroarch", "n64", "unknown_engine"];

    invalidEngines.forEach((engine) => {
      it(`should throw expected error for getEmulatorConfigPath with engine: "${engine}"`, () => {
        const handler = new WinHandler();
        expect(() => handler.getEmulatorConfigPath(engine as EngineID)).toThrow(
          `Unknown emulator: ${engine}`
        );
      });

      it(`should throw expected error for getEmulatorBasePath with engine: "${engine}"`, () => {
        const handler = new WinHandler();
        expect(() => handler.getEmulatorBasePath(engine as EngineID)).toThrow(
          `Unknown emulator: ${engine}`
        );
      });

      it(`should throw expected error for getBiosPath with engine: "${engine}"`, () => {
        const handler = new WinHandler();
        expect(() => handler.getBiosPath(engine as EngineID)).toThrow(
          `Unknown emulator: ${engine}`
        );
      });

      it(`should throw expected error for getSavePath with engine: "${engine}"`, () => {
        const handler = new WinHandler();
        const game = { engineId: engine as EngineID } as Game;
        expect(() => handler.getSavePath(game)).toThrow(
          `Unknown emulator: ${engine}`
        );
      });
    });
  });
});
