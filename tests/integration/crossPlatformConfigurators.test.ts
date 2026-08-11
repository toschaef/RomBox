jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata-crossplatform"),
  };
});

import path from "path";
import fs from "fs";
import type { Game } from "../../src/shared/types";
import { cleanTempDirCrossPlatform } from "../helpers/tempDirs";

describe("Cross-Platform (win32 & darwin) Integration Tests for POC Emulators", () => {
  const tempDir = path.resolve(__dirname, "../temp-userdata-crossplatform");
  const originalPlatform = process.platform;
  const originalEnv = process.env;

  const cleanTempDir = () => cleanTempDirCrossPlatform(tempDir);

  beforeEach(() => {
    cleanTempDir();
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    process.env = originalEnv;
    jest.restoreAllMocks();
    jest.resetModules();
    cleanTempDir();
  });

  const platforms = ["win32", "darwin"] as const;

  for (const plat of platforms) {
    describe(`Platform Context: ${plat}`, () => {
      let DuckStationConfigurator: typeof import("../../src/main/emulators/duckstation/configurator").DuckStationConfigurator;
      let MesenConfigurator: typeof import("../../src/main/emulators/mesen/configurator").MesenConfigurator;
      let AresConfigurator: typeof import("../../src/main/emulators/ares/configurator").AresConfigurator;
      let DolphinConfigurator: typeof import("../../src/main/emulators/dolphin/configurator").DolphinConfigurator;
      let EngineService: typeof import("../../src/main/services/EngineService").EngineService;
      let DuckStation: typeof import("../../src/main/emulators/duckstation/schema").DuckStation;
      let osHandler: typeof import("../../src/main/platform").osHandler;

      beforeEach(() => {
        Object.defineProperty(process, "platform", {
          value: plat,
          configurable: true,
        });

        process.env = { ...originalEnv };
        if (plat === "win32") {
          process.env.USERPROFILE = tempDir;
          process.env.APPDATA = path.join(tempDir, "AppData", "Roaming");
          process.env.LOCALAPPDATA = path.join(tempDir, "AppData", "Local");
          process.env.HOME = tempDir;
        } else {
          process.env.HOME = tempDir;
          delete process.env.USERPROFILE;
          delete process.env.APPDATA;
          delete process.env.LOCALAPPDATA;
        }

        jest.resetModules();

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const dbModule = require("../../src/main/data/db");
        dbModule.initDB();

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const platformModule = require("../../src/main/platform");
        osHandler = platformModule.osHandler;

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        DuckStationConfigurator = require("../../src/main/emulators/duckstation/configurator").DuckStationConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        MesenConfigurator = require("../../src/main/emulators/mesen/configurator").MesenConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        AresConfigurator = require("../../src/main/emulators/ares/configurator").AresConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        DolphinConfigurator = require("../../src/main/emulators/dolphin/configurator").DolphinConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        EngineService = require("../../src/main/services/EngineService").EngineService;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        DuckStation = require("../../src/main/emulators/duckstation/schema").DuckStation;
      });

      it(`should configure DuckStation correctly on ${plat}`, async () => {
        expect(osHandler.getPlatform()).toBe(plat);
        const configurator = new DuckStationConfigurator();
        await configurator.configure();

        const baseDir = osHandler.getEmulatorBasePath("duckstation");
        const settingsIniPath = DuckStation.iniPath(baseDir);
        expect(fs.existsSync(settingsIniPath)).toBe(true);

        const iniText = fs.readFileSync(settingsIniPath, "utf-8");
        expect(iniText).toContain("[Pad1]");
        expect(iniText).toContain("Cross = Keyboard/U");
        expect(iniText).toContain("Start = Keyboard/T");
      });

      it(`should configure Mesen2 (SNES) with platform-appropriate keycodes on ${plat}`, async () => {
        expect(osHandler.getPlatform()).toBe(plat);
        const configurator = new MesenConfigurator("snes");
        await configurator.configure();

        const configDir = osHandler.getEmulatorConfigPath("mesen");
        const settingsJsonPath = path.join(configDir, "settings.json");
        expect(fs.existsSync(settingsJsonPath)).toBe(true);

        const text = fs.readFileSync(settingsJsonPath, "utf-8");
        const settings = JSON.parse(text);

        expect(settings.Snes?.Port1?.Mapping1).toBeDefined();
        const mapping1 = settings.Snes.Port1.Mapping1;

        if (plat === "win32") {
          // Windows VK code for 'KeyU' is 85, 'KeyT' is 84
          expect(mapping1.A).toBe(85);
          expect(mapping1.Start).toBe(84);
        } else {
          // macOS Apple keycode for 'KeyU' mapped to 64, 'KeyT' to 63
          expect(mapping1.A).toBe(64);
          expect(mapping1.Start).toBe(63);
        }
      });

      it(`should configure Ares with platform-appropriate keycodes on ${plat}`, async () => {
        expect(osHandler.getPlatform()).toBe(plat);
        jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(null);

        const configurator = new AresConfigurator();
        await configurator.configure();

        const configDir = osHandler.getEmulatorConfigPath("ares");
        const settingsBmlPath = path.join(configDir, "settings.bml");
        expect(fs.existsSync(settingsBmlPath)).toBe(true);

        const bmlText = fs.readFileSync(settingsBmlPath, "utf-8");
        expect(bmlText).toContain("VirtualPad1");

        if (plat === "win32") {
          // Ares indexes into its rawinput key list on win32, not raw VK codes:
          // 'KeyT' -> index 54, 'KeyU' -> index 55
          expect(bmlText).toContain("Start: 0x1/0/54;;");
          expect(bmlText).toContain("A..South: 0x1/0/55;;");
        } else {
          // macOS Quartz index for 'KeyT' (59) -> 0x1/0/59;;
          // macOS Quartz index for 'KeyU' (60) -> 0x1/0/60;;
          expect(bmlText).toContain("Start: 0x1/0/59;;");
          expect(bmlText).toContain("A..South: 0x1/0/60;;");
        }
      });

      it(`should configure Dolphin (GC) with platform-appropriate device strings on ${plat}`, async () => {
        expect(osHandler.getPlatform()).toBe(plat);
        const game: Game = {
          id: "wind-waker",
          title: "The Legend of Zelda: The Wind Waker",
          filePath: "/roms/ww.iso",
          consoleId: "gc",
          engineId: "dolphin",
          playtimeSeconds: 0,
          lastPlayedAt: 0,
        };
        const configurator = new DolphinConfigurator(game);
        await configurator.configure();

        const configDir = osHandler.getEmulatorConfigPath("dolphin");
        const gcPadNewPath = path.join(configDir, "GCPadNew.ini");
        expect(fs.existsSync(gcPadNewPath)).toBe(true);

        const gcPadText = fs.readFileSync(gcPadNewPath, "utf-8");
        if (plat === "win32") {
          expect(gcPadText).toContain("Device = DInput/0/Keyboard Mouse");
        } else {
          expect(gcPadText).toContain("Device = Quartz/0/Keyboard");
        }
        expect(gcPadText).toContain("Buttons/A = U");
        expect(gcPadText).toContain("Buttons/Start = T");
      });
    });
  }
});
