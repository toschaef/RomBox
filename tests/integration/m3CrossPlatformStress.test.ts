jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata-crossplatform-stress"),
  };
});

import path from "path";
import fs from "fs";
import type { Game } from "../../src/shared/types";

describe("Milestone 3 Empirical Stress Test Harness - Cross-Platform Integration & 4 POC Emulators", () => {
  const tempDir = path.resolve(__dirname, "../temp-userdata-crossplatform-stress");
  const originalPlatform = process.platform;
  const originalEnv = process.env;

  const cleanTempDir = () => {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        // Ignore cleanup error
      }
    }
  };

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

  platforms.forEach((plat) => {
    describe(`Deep Assertion Harness for Platform: ${plat}`, () => {
      let DuckStationConfigurator: any;
      let MesenConfigurator: any;
      let AresConfigurator: any;
      let DolphinConfigurator: any;
      let EngineService: any;
      let osHandler: any;

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
        DuckStationConfigurator = require("../../src/main/utils/configurators/DuckStationConfigurator").DuckStationConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        MesenConfigurator = require("../../src/main/utils/configurators/MesenConfigurator").MesenConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        AresConfigurator = require("../../src/main/utils/configurators/AresConfigurator").AresConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        DolphinConfigurator = require("../../src/main/utils/configurators/DolphinConfigurator").DolphinConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        EngineService = require("../../src/main/services/EngineService").EngineService;
      });

      it(`1. DuckStation deep assertion on ${plat}`, async () => {
        const configurator = new DuckStationConfigurator();
        await configurator.configure();

        const baseDir = osHandler.getEmulatorBasePath("duckstation");
        const settingsIniPath = path.join(baseDir, "settings.ini");

        expect(fs.existsSync(settingsIniPath)).toBe(true);
        const iniText = fs.readFileSync(settingsIniPath, "utf-8");

        expect(iniText).toContain("[Pad1]");
        expect(iniText).toContain("Type = AnalogController");
        expect(iniText).toContain("Cross = Keyboard/U");
        expect(iniText).toContain("Circle = Keyboard/I");
        expect(iniText).toContain("Square = Keyboard/O");
        expect(iniText).toContain("Triangle = Keyboard/P");
        expect(iniText).toContain("Start = Keyboard/T");
        expect(iniText).toContain("Select = Keyboard/Y");
      });

      it(`2. Mesen 2 (SNES + NES) deep assertion on ${plat}`, async () => {
        const snesConfigurator = new MesenConfigurator("snes");
        await snesConfigurator.configure();

        const configDir = osHandler.getEmulatorConfigPath("mesen");
        const settingsJsonPath = path.join(configDir, "settings.json");
        expect(fs.existsSync(settingsJsonPath)).toBe(true);

        const settings = JSON.parse(fs.readFileSync(settingsJsonPath, "utf-8"));
        expect(settings.Snes?.Port1?.Mapping1).toBeDefined();

        const m1 = settings.Snes.Port1.Mapping1;
        if (plat === "win32") {
          expect(m1.A).toBe(85); // VK KeyU
          expect(m1.B).toBe(73); // VK KeyI
          expect(m1.X).toBe(79); // VK KeyO
          expect(m1.Y).toBe(80); // VK KeyP
          expect(m1.Start).toBe(84); // VK KeyT
          expect(m1.Select).toBe(89); // VK KeyY
        } else {
          expect(m1.A).toBe(64); // Apple KeyU
          expect(m1.B).toBe(52); // Apple KeyI mapped to Mesen B
          expect(m1.X).toBe(58); // Apple KeyO mapped to Mesen X
          expect(m1.Y).toBe(59); // Apple KeyP mapped to Mesen Y
          expect(m1.Start).toBe(63); // Apple KeyT
          expect(m1.Select).toBe(68); // Apple KeyY
        }
      });

      it(`3. Ares deep assertion on ${plat}`, async () => {
        jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(null);
        const configurator = new AresConfigurator();
        await configurator.configure();

        const configDir = osHandler.getEmulatorConfigPath("ares");
        const settingsBmlPath = path.join(configDir, "settings.bml");
        expect(fs.existsSync(settingsBmlPath)).toBe(true);

        const bmlText = fs.readFileSync(settingsBmlPath, "utf-8");
        expect(bmlText).toContain("VirtualPad1");

        if (plat === "win32") {
          expect(bmlText).toContain("Start: 0x1/0/84;;");
          expect(bmlText).toContain("Select: 0x1/0/89;;");
          expect(bmlText).toContain("A..South: 0x1/0/85;;");
          expect(bmlText).toContain("B..East: 0x1/0/73;;");
          expect(bmlText).toContain("X..West: 0x1/0/79;;");
          expect(bmlText).toContain("Y..North: 0x1/0/80;;");
        } else {
          expect(bmlText).toContain("Start: 0x1/0/59;;");
          expect(bmlText).toContain("Select: 0x1/0/64;;");
          expect(bmlText).toContain("A..South: 0x1/0/60;;");
          expect(bmlText).toContain("B..East: 0x1/0/48;;");
          expect(bmlText).toContain("X..West: 0x1/0/54;;");
          expect(bmlText).toContain("Y..North: 0x1/0/55;;");
        }
      });

      it(`4. Dolphin (GC and Wii) deep assertion on ${plat}`, async () => {
        const gcGame: Game = {
          id: "melee",
          title: "Super Smash Bros. Melee",
          filePath: "/roms/melee.iso",
          consoleId: "gc",
          engineId: "dolphin",
          playtimeSeconds: 0,
          lastPlayedAt: 0,
        };
        const gcConfigurator = new DolphinConfigurator(gcGame);
        await gcConfigurator.configure();

        const configDir = osHandler.getEmulatorConfigPath("dolphin");
        const gcPadPath = path.join(configDir, "GCPadNew.ini");
        expect(fs.existsSync(gcPadPath)).toBe(true);

        const gcPadText = fs.readFileSync(gcPadPath, "utf-8");
        if (plat === "win32") {
          expect(gcPadText).toContain("Device = DInput/0/Keyboard Mouse");
        } else {
          expect(gcPadText).toContain("Device = Quartz/0/Keyboard");
        }
        expect(gcPadText).toContain("Buttons/A = U");
        expect(gcPadText).toContain("Buttons/B = I");
        expect(gcPadText).toContain("Buttons/X = O");
        expect(gcPadText).toContain("Buttons/Y = P");
        expect(gcPadText).toContain("Buttons/Start = T");

        // Now test Wii console configuration
        const wiiGame: Game = {
          id: "mario-galaxy",
          title: "Super Mario Galaxy",
          filePath: "/roms/galaxy.wbfs",
          consoleId: "wii",
          engineId: "dolphin",
          playtimeSeconds: 0,
          lastPlayedAt: 0,
        };
        const wiiConfigurator = new DolphinConfigurator(wiiGame);
        await wiiConfigurator.configure();

        const wiimotePath = path.join(configDir, "WiimoteNew.ini");
        expect(fs.existsSync(wiimotePath)).toBe(true);
        const wiimoteText = fs.readFileSync(wiimotePath, "utf-8");
        if (plat === "win32") {
          expect(wiimoteText).toContain("Device = DInput/0/Keyboard Mouse");
        } else {
          expect(wiimoteText).toContain("Device = Quartz/0/Keyboard");
        }
      });
    });
  });

  describe("Flakiness & Platform Swapping Stress Iterations", () => {
    it("should execute 10 alternating platform configurations without error or flakiness", async () => {
      for (let i = 0; i < 10; i++) {
        const plat = i % 2 === 0 ? "win32" : "darwin";
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
        const DuckStationConfigurator = require("../../src/main/utils/configurators/DuckStationConfigurator").DuckStationConfigurator;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const MesenConfigurator = require("../../src/main/utils/configurators/MesenConfigurator").MesenConfigurator;

        const duckConfig = new DuckStationConfigurator();
        await expect(duckConfig.configure()).resolves.not.toThrow();

        const mesenConfig = new MesenConfigurator("snes");
        await expect(mesenConfig.configure()).resolves.not.toThrow();
      }
    });
  });
});
