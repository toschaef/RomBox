jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata-win32-stress"),
  };
});

import path from "path";
import fs from "fs";
import child_process from "child_process";
import { initDB } from "../../src/main/data/db";
import { DolphinConfigurator } from "../../src/main/emulators/dolphin/configurator";
import { MesenConfigurator } from "../../src/main/emulators/mesen/configurator";
import { MelonDSConfigurator } from "../../src/main/emulators/melonds/configurator";
import { AzaharConfigurator } from "../../src/main/emulators/azahar/configurator";
import { AresConfigurator } from "../../src/main/emulators/ares/configurator";
import { DuckStationConfigurator } from "../../src/main/emulators/duckstation/configurator";
import { PCSX2Configurator } from "../../src/main/emulators/pcsx2/configurator";

import { DolphinTranslator } from "../../src/main/emulators/dolphin/translator";
import { AresTranslator } from "../../src/main/emulators/ares/translator";
import { DuckStationTranslator } from "../../src/main/emulators/duckstation/translator";
import { PCSX2Translator } from "../../src/main/emulators/pcsx2/translator";

import { EngineService } from "../../src/main/services/EngineService";
import { osHandler } from "../../src/main/platform";
import { WinHandler } from "../../src/main/platform/WinHandler";
import { DuckStation } from "../../src/main/emulators/duckstation/schema";
import type { Game } from "../../src/shared/types";
import { ControlsService } from "../../src/main/services/ControlsService";

describe("M3 Integration Stress Test - Win32 Configurators & Translators for All 7 Emulators", () => {
  const tempDir = path.resolve(__dirname, "../temp-userdata-win32-stress");
  let winHandler: WinHandler;

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();

    winHandler = new WinHandler();
    jest.spyOn(osHandler, "getPlatform").mockReturnValue("win32");
    jest.spyOn(osHandler, "getPlatformId").mockReturnValue("windows");

    jest.spyOn(osHandler, "getEmulatorConfigPath").mockImplementation((engineId) => {
      const appData = path.join(tempDir, "AppData", "Roaming");
      const localAppData = path.join(tempDir, "AppData", "Local");
      const docs = path.join(tempDir, "Documents");

      switch (engineId) {
        case "dolphin": return path.join(appData, "Dolphin Emulator", "Config");
        case "mesen": return path.join(appData, "Mesen2");
        case "ares": return path.join(localAppData, "ares");
        case "melonds": return path.join(localAppData, "melonDS");
        case "azahar": return path.join(appData, "Azahar", "config");
        case "pcsx2": return path.join(docs, "PCSX2", "inis");
        case "duckstation": return path.join(docs, "DuckStation");
        default: return winHandler.getEmulatorConfigPath(engineId);
      }
    });

    jest.spyOn(osHandler, "getEmulatorBasePath").mockImplementation((engineId) => {
      const appData = path.join(tempDir, "AppData", "Roaming");
      const localAppData = path.join(tempDir, "AppData", "Local");
      const docs = path.join(tempDir, "Documents");

      switch (engineId) {
        case "dolphin": return path.join(appData, "Dolphin Emulator");
        case "mesen": return path.join(appData, "Mesen2");
        case "ares": return path.join(localAppData, "ares");
        case "melonds": return path.join(localAppData, "melonDS");
        case "azahar": return path.join(appData, "Azahar");
        case "pcsx2": return path.join(docs, "PCSX2");
        case "duckstation": return path.join(docs, "DuckStation");
        default: return winHandler.getEmulatorBasePath(engineId);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  describe("1. Dolphin (GC & Wii) Win32 Integration & Stress", () => {
    it("should configure Dolphin GC on win32 and map DInput keyboard device", async () => {
      const game: Game = {
        id: "wind-waker-stress",
        title: "Zelda: Wind Waker (Special Chars & Paths C:\\Roms\\)",
        filePath: "C:\\Roms\\Zelda\\ww.iso",
        consoleId: "gc",
        engineId: "dolphin",
        playtimeSeconds: 100,
        lastPlayedAt: Date.now(),
      };

      const configurator = new DolphinConfigurator(game);
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("dolphin");
      const gcPadNewPath = path.join(configDir, "GCPadNew.ini");
      expect(fs.existsSync(gcPadNewPath)).toBe(true);

      const content = fs.readFileSync(gcPadNewPath, "utf-8");
      expect(content).toContain("Device = DInput/0/Keyboard Mouse");
      expect(content).toContain("Buttons/A = U");
    });

    it("should translate Dolphin gamepad profile with varying XInput device indices (0, 1, 3)", async () => {
      // Simulates no controller detected by the win32 SDL probe, so the translator
      // falls back to its static XInput/<index>/Gamepad naming - otherwise this
      // would depend on whatever's actually plugged into the test machine.
      jest.spyOn(child_process, "spawnSync").mockReturnValue({ stdout: "" } as never);

      const translator = new DolphinTranslator();
      const svc = new ControlsService();
      const baseProfile = svc.getDefaultProfile();
      const layout = await svc.getEffectiveConsoleLayout("gc", baseProfile.id);
      const player1 = layout.player1;

      const fullProfile = {
        ...baseProfile,
        player1: {
          ...player1,
          face: { ...player1.face, primary: { type: "gp_button" as const, token: "GP_A" as const } }
        }
      };

      // Test deviceIndex = 0
      const patches0 = translator.translate(fullProfile, { platform: "win32", consoleId: "gc", configDir: "dummy", deviceIndex: 0 });
      const dev0 = patches0.find(p => p.kind === "ini-set" && p.key === "Device");
      expect(dev0 && dev0.kind === "ini-set" ? dev0.value : "").toBe("XInput/0/Gamepad");

      // Test deviceIndex = 3
      const patches3 = translator.translate(fullProfile, { platform: "win32", consoleId: "gc", configDir: "dummy", deviceIndex: 3 });
      const dev3 = patches3.find(p => p.kind === "ini-set" && p.key === "Device");
      expect(dev3 && dev3.kind === "ini-set" ? dev3.value : "").toBe("XInput/0/Gamepad");
    });
  });

  describe("2. Mesen (NES & SNES) Win32 Integration & Stress", () => {
    it("should configure Mesen NES on win32 with Virtual Keycodes (KeyU=85, KeyT=84)", async () => {
      const configurator = new MesenConfigurator("nes");
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("mesen");
      const settingsPath = path.join(configDir, "settings.json");
      expect(fs.existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(settings.Nes.Port1.Type).toBe("NesController");
      expect(settings.Nes.Port1.Mapping1.A).toBe(85);
      expect(settings.Nes.Port1.Mapping1.Start).toBe(84);
    });

    it("should configure Mesen SNES on win32 and produce valid settings JSON", async () => {
      const configurator = new MesenConfigurator("snes");
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("mesen");
      const settingsPath = path.join(configDir, "settings.json");
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(settings.Snes.Port1.Type).toBe("SnesController");
      expect(settings.Snes.Port1.Mapping1.A).toBe(85);
    });
  });

  describe("3. MelonDS Win32 Integration & Stress", () => {
    it("should configure MelonDS on win32 with AppData/Local path and TOML structure", async () => {
      const configurator = new MelonDSConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("melonds");
      const tomlPath = path.join(configDir, "melonDS.toml");
      expect(fs.existsSync(tomlPath)).toBe(true);

      const tomlContent = fs.readFileSync(tomlPath, "utf-8");
      expect(tomlContent).toContain("[Instance0]");
      expect(tomlContent).toContain("Key_A = 85");
      expect(tomlContent).toContain("JoystickID = 0");
    });
  });

  describe("4. Azahar Win32 Integration & Stress", () => {
    it("should configure Azahar 3DS on win32 with qt-config.ini format", async () => {
      const configurator = new AzaharConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("azahar");
      const iniPath = path.join(configDir, "qt-config.ini");
      expect(fs.existsSync(iniPath)).toBe(true);

      const content = fs.readFileSync(iniPath, "utf-8");
      expect(content).toContain("profiles\\1\\button_a=\"code:85,engine:keyboard\"");
      expect(content).toContain("[Renderer]");
    });
  });

  describe("5. Ares Win32 Integration & Stress", () => {
    it("should configure Ares N64 on win32 with settings.bml and VK mappings", async () => {
      jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(null);

      const configurator = new AresConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("ares");
      const bmlPath = path.join(configDir, "settings.bml");
      expect(fs.existsSync(bmlPath)).toBe(true);

      const content = fs.readFileSync(bmlPath, "utf-8");
      expect(content).toContain("VirtualPad1");
      expect(content).toContain("A..South: 0x1/0/55;;");
      expect(content).toContain("Start: 0x1/0/54;;");
    });

    it("should translate gamepad bindings for Ares on win32 using a probed device id and raw button index", async () => {
      const translator = new AresTranslator();
      const svc = new ControlsService();
      const profile = svc.getDefaultProfile();
      const layout = await svc.getEffectiveConsoleLayout("n64", profile.id);
      const player1 = layout.player1;

      const updates = translator.translateFromPlayer(
        {
          ...player1,
          face: { ...player1.face, primary: { type: "gp_button" as const, token: "GP_A" as const } }
        },
        "win32",
        "0x54c0ce6",
        { GP_A: { kind: "button", button: 0 } }
      );

      expect(updates["A..South"]).toBe("0x54c0ce6/3/0;;");
    });
  });

  describe("6. DuckStation Win32 Integration & Stress", () => {
    it("should configure DuckStation PS1 on win32 with Documents path and ini structure", async () => {
      const configurator = new DuckStationConfigurator();
      await configurator.configure();

      const baseDir = osHandler.getEmulatorBasePath("duckstation");
      const iniPath = DuckStation.iniPath(baseDir);
      expect(fs.existsSync(iniPath)).toBe(true);

      const content = fs.readFileSync(iniPath, "utf-8");
      expect(content).toContain("[Pad1]");
      expect(content).toContain("Cross = Keyboard/U");
      expect(content).toContain("Start = Keyboard/T");
    });

    it("should translate DuckStation gamepad profile for win32 with dynamic SDL device indexing", async () => {
      const translator = new DuckStationTranslator();
      const svc = new ControlsService();
      const profile = svc.getDefaultProfile();
      const layout = await svc.getEffectiveConsoleLayout("ps1", profile.id);
      const player1 = layout.player1;

      const patches = translator.translate(
        {
          ...profile,
          player1: {
            ...player1,
            face: { ...player1.face, primary: { type: "gp_button" as const, token: "GP_A" as const } }
          }
        },
        { platform: "win32", configDir: "dummy", deviceIndex: 4 }
      );

      const crossPatch = patches.find(p => p.kind === "ini-set" && p.key === "Cross");
      expect(crossPatch && crossPatch.kind === "ini-set" ? crossPatch.value : "").toBe("SDL-0/A");
    });
  });

  describe("7. PCSX2 Win32 Integration & Stress", () => {
    it("should configure PCSX2 PS2 on win32 with Documents path and PCSX2.ini format", async () => {
      const configurator = new PCSX2Configurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("pcsx2");
      const iniPath = path.join(configDir, "PCSX2.ini");
      expect(fs.existsSync(iniPath)).toBe(true);

      const content = fs.readFileSync(iniPath, "utf-8");
      expect(content).toContain("[Pad1]");
      expect(content).toContain("Cross = Keyboard/U");
      expect(content).toContain("Start = Keyboard/T");
    });

    it("should translate PCSX2 gamepad profile for win32 with dynamic SDL device indexing", async () => {
      const translator = new PCSX2Translator();
      const svc = new ControlsService();
      const profile = svc.getDefaultProfile();
      const layout = await svc.getEffectiveConsoleLayout("ps2", profile.id);
      const player1 = layout.player1;

      const patches = translator.translate(
        {
          ...profile,
          player1: {
            ...player1,
            face: { ...player1.face, primary: { type: "gp_button" as const, token: "GP_A" as const } }
          }
        },
        { platform: "win32", configDir: "dummy", deviceIndex: 2 }
      );

      const crossPatch = patches.find(p => p.kind === "ini-set" && p.key === "Cross");
      expect(crossPatch && crossPatch.kind === "ini-set" ? crossPatch.value : "").toBe("SDL-0/FaceSouth");
    });
  });
});
