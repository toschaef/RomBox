import { MacHandler } from "../../../src/main/platform/MacHandler";
import type { Game } from "../../../src/shared/types";
import type { EngineID } from "../../../src/shared/types/engines";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

jest.mock("child_process", () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
  spawn: jest.fn()
}));

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    copyFileSync: jest.fn(),
    renameSync: jest.fn(),
    chmodSync: jest.fn(),
    statSync: jest.fn(),
    mkdirSync: jest.fn(),
    promises: {
      ...actual.promises,
      rm: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      rename: jest.fn().mockResolvedValue(undefined),
      copyFile: jest.fn().mockResolvedValue(undefined)
    }
  };
});

jest.mock("os", () => ({
  homedir: () => "/mock/home"
}));

describe("MacHandler", () => {
  let handler: MacHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new MacHandler();
  });

  describe("getEmulatorConfigPath", () => {
    it("should return correct path for Dolphin", () => {
      expect(handler.getEmulatorConfigPath("dolphin")).toBe(
        path.join("/mock/home", "Library", "Application Support", "Dolphin", "Config")
      );
    });

    it("should return correct path for Mesen", () => {
      expect(handler.getEmulatorConfigPath("mesen")).toBe(
        path.join("/mock/home", "Library", "Application Support", "Mesen2")
      );
    });

    it("should throw for unsupported engines", () => {
      expect(() => handler.getEmulatorConfigPath("unsupported" as EngineID)).toThrow();
    });
  });

  describe("getEmulatorBasePath", () => {
    it("should return correct base path for dolphin", () => {
      expect(handler.getEmulatorBasePath("dolphin")).toBe(
        path.join("/mock/home", "Library", "Application Support", "Dolphin")
      );
    });
  });

  describe("getSavePath", () => {
    it("should return correct save path for mesen", () => {
      const mockGame = { engineId: "mesen", filePath: "/roms/nes/game.nes", consoleId: "nes", id: "dummy", title: "Dummy", playtimeSeconds: 0, lastPlayedAt: 0 } as Game;
      expect(handler.getSavePath(mockGame)).toBe(
        path.join("/mock/home", "Library", "Application Support", "Mesen2", "Saves")
      );
    });

    it("should return file parent folder for melonds", () => {
      const mockGame = { engineId: "melonds", filePath: "/roms/ds/game.nds", consoleId: "ds", id: "dummy", title: "Dummy", playtimeSeconds: 0, lastPlayedAt: 0 } as Game;
      expect(handler.getSavePath(mockGame)).toBe("/roms/ds");
    });
  });



  describe("launchProcess", () => {
    it("should spawn executable binary with correct arguments and environment", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      handler.launchProcess("/path/bin", ["--arg"]);

      expect(spawn).toHaveBeenCalledWith(
        "/path/bin",
        ["--arg"],
        expect.objectContaining({
          detached: true,
          env: expect.objectContaining({
            LANG: "en_US.UTF-8",
            LC_ALL: "en_US.UTF-8"
          })
        })
      );
    });
  });
});
