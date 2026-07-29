jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata"),
  };
});

import path from "path";
import fs from "fs";
import { initDB, closeDB } from "../../src/main/data/db";
import { DolphinConfigurator } from "../../src/main/utils/configurators/DolphinConfigurator";
import { MesenConfigurator } from "../../src/main/utils/configurators/MesenConfigurator";
import { MelonDSConfigurator } from "../../src/main/utils/configurators/MelonDSConfigurator";
import { AzaharConfigurator } from "../../src/main/utils/configurators/AzaharConfigurator";
import { AresConfigurator } from "../../src/main/utils/configurators/AresConfigurator";
import { DuckStationConfigurator } from "../../src/main/utils/configurators/DuckStationConfigurator";
import { PCSX2Configurator } from "../../src/main/utils/configurators/PCSX2Configurator";

import { DolphinTranslator } from "../../src/main/utils/translators/DolphinTranslator";
import { AresTranslator } from "../../src/main/utils/translators/AresTranslator";
import { DuckStationTranslator } from "../../src/main/utils/translators/DuckStationTranslator";
import { PCSX2Translator } from "../../src/main/utils/translators/PCSX2Translator";

import { EngineService } from "../../src/main/services/EngineService";
import { osHandler } from "../../src/main/platform";
import { WinHandler } from "../../src/main/platform/WinHandler";
import { DuckStation } from "../../src/main/utils/schema/duckstation";
import type { Game } from "../../src/shared/types";
import { ControlsService } from "../../src/main/services/ControlsService";

describe("Configurator and Translator Pairs Integration Tests", () => {
  const tempDir = path.resolve(__dirname, "../temp-userdata");

  const cleanTempDir = () => {
    closeDB();
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        // Ignore cleanup error if directory locked temporarily
      }
    }
  };

  beforeEach(() => {
    cleanTempDir();
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();
  });

  afterEach(() => {
    closeDB();
    jest.restoreAllMocks();
    cleanTempDir();
  });

  describe("darwin / macOS Platform Configuration", () => {
    it("should configure DolphinConfigurator (GameCube) and DolphinTranslator correctly", async () => {
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

      // Verify written Dolphin.ini
      const dolphinIniPath = path.join(configDir, "Dolphin.ini");
      expect(fs.existsSync(dolphinIniPath)).toBe(true);
      const dolphinText = fs.readFileSync(dolphinIniPath, "utf-8");
      expect(dolphinText).toContain("RenderToMain = False");
      expect(dolphinText).toContain("Fullscreen = False");

      // Verify written GFX.ini
      const gfxIniPath = path.join(configDir, "GFX.ini");
      expect(fs.existsSync(gfxIniPath)).toBe(true);
      const gfxText = fs.readFileSync(gfxIniPath, "utf-8");
      expect(gfxText).toContain("InternalResolution = 1");

      // Verify written GCPadNew.ini (mapped buttons)
      const gcPadNewPath = path.join(configDir, "GCPadNew.ini");
      expect(fs.existsSync(gcPadNewPath)).toBe(true);
      const gcPadText = fs.readFileSync(gcPadNewPath, "utf-8");
      expect(gcPadText).toContain("Buttons/A = U");
      expect(gcPadText).toContain("Buttons/Start = T");
    });

    it("should configure DolphinConfigurator (Wii) and DolphinTranslator correctly", async () => {
      const game: Game = {
        id: "mario-galaxy",
        title: "Super Mario Galaxy",
        filePath: "/roms/smg.iso",
        consoleId: "wii",
        engineId: "dolphin",
        playtimeSeconds: 0,
        lastPlayedAt: 0,
      };
      const configurator = new DolphinConfigurator(game);
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("dolphin");

      // Verify written Dolphin.ini
      const dolphinIniPath = path.join(configDir, "Dolphin.ini");
      expect(fs.existsSync(dolphinIniPath)).toBe(true);
      const dolphinText = fs.readFileSync(dolphinIniPath, "utf-8");
      expect(dolphinText).toContain("WiimoteSource0 = 1");

      // Verify written WiimoteNew.ini (Wii controls with Classic extension)
      const wiimoteNewPath = path.join(configDir, "WiimoteNew.ini");
      expect(fs.existsSync(wiimoteNewPath)).toBe(true);
      const wiiText = fs.readFileSync(wiimoteNewPath, "utf-8");
      expect(wiiText).toContain("Extension = Classic");
      expect(wiiText).toContain("Classic/Buttons/A = U");
      expect(wiiText).toContain("Classic/Buttons/+ = T");
    });

    it("should configure MesenConfigurator (NES) and MesenTranslator correctly", async () => {
      const configurator = new MesenConfigurator("nes");
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("mesen");
      const settingsJsonPath = path.join(configDir, "settings.json");
      expect(fs.existsSync(settingsJsonPath)).toBe(true);

      const text = fs.readFileSync(settingsJsonPath, "utf-8");
      const settings = JSON.parse(text);

      expect(settings.Nes).toBeDefined();
      expect(settings.Nes.Port1).toBeDefined();
      expect(settings.Nes.Port1.Type).toBe("NesController");

      const mapping1 = settings.Nes.Port1.Mapping1;
      expect(mapping1).toBeDefined();
      expect(mapping1.A).toBe(64); // 'KeyU' -> A -> 64 (Apple Keycode for Mac)
      expect(mapping1.Start).toBe(63); // 'KeyT' -> Start -> 63
    });

    it("should configure MesenConfigurator (SNES) and MesenTranslator correctly", async () => {
      const configurator = new MesenConfigurator("snes");
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("mesen");
      const settingsJsonPath = path.join(configDir, "settings.json");
      expect(fs.existsSync(settingsJsonPath)).toBe(true);

      const text = fs.readFileSync(settingsJsonPath, "utf-8");
      const settings = JSON.parse(text);

      expect(settings.Snes).toBeDefined();
      expect(settings.Snes.Port1).toBeDefined();
      expect(settings.Snes.Port1.Type).toBe("SnesController");

      const mapping1 = settings.Snes.Port1.Mapping1;
      expect(mapping1).toBeDefined();
      expect(mapping1.A).toBe(64); // 'KeyU' -> A -> 64
      expect(mapping1.Start).toBe(63); // 'KeyT' -> Start -> 63
    });

    it("should configure MelonDSConfigurator and MelonDSTranslator correctly", async () => {
      const configurator = new MelonDSConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("melonds");
      const melonTomlPath = path.join(configDir, "melonDS.toml");
      expect(fs.existsSync(melonTomlPath)).toBe(true);

      const tomlText = fs.readFileSync(melonTomlPath, "utf-8");
      expect(tomlText).toContain("[Instance0]");
      expect(tomlText).toContain("Key_A = 85");
      expect(tomlText).toContain("Key_Start = 84");

      expect(tomlText).toContain("[Instance0.Keyboard]");
      expect(tomlText).toContain("A = 85");
      expect(tomlText).toContain("Start = 84");
    });

    it("should configure AzaharConfigurator and AzaharTranslator correctly", async () => {
      const configurator = new AzaharConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("azahar");
      const qtIniPath = path.join(configDir, "qt-config.ini");
      expect(fs.existsSync(qtIniPath)).toBe(true);

      const iniText = fs.readFileSync(qtIniPath, "utf-8");
      expect(iniText).toContain("[Controls]");
      expect(iniText).toContain("profiles\\1\\button_a=\"code:85,engine:keyboard\"");
      expect(iniText).toContain("profiles\\1\\button_start=\"code:84,engine:keyboard\"");

      expect(iniText).toContain("[UI]");
      expect(iniText).toContain("fullscreen=false");

      expect(iniText).toContain("[Renderer]");
      expect(iniText).toContain("resolution_factor=1");
    });

    it("should configure AresConfigurator and AresTranslator correctly", async () => {
      jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(null);
      const configurator = new AresConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("ares");
      const settingsBmlPath = path.join(configDir, "settings.bml");
      expect(fs.existsSync(settingsBmlPath)).toBe(true);

      const bmlText = fs.readFileSync(settingsBmlPath, "utf-8");
      expect(bmlText).toContain("VirtualPad1");
      expect(bmlText).toContain("Pad.Up: 0x1/0/24;;");
      expect(bmlText).toContain("Start: 0x1/0/59;;");
      expect(bmlText).toContain("A..South: 0x1/0/60;;");
    });

    it("should configure DuckStationConfigurator and DuckStationTranslator correctly", async () => {
      const configurator = new DuckStationConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorBasePath("duckstation");
      const settingsIniPath = DuckStation.iniPath(configDir);
      expect(fs.existsSync(settingsIniPath)).toBe(true);

      const iniText = fs.readFileSync(settingsIniPath, "utf-8");
      expect(iniText).toContain("[Main]");
      expect(iniText).toContain("StartFullscreen = false");

      expect(iniText).toContain("[GPU]");
      expect(iniText).toContain("ResolutionScale = 1");

      expect(iniText).toContain("[Pad1]");
      expect(iniText).toContain("Cross = Keyboard/U");
      expect(iniText).toContain("Start = Keyboard/T");
    });

    it("should configure PCSX2Configurator and PCSX2Translator correctly", async () => {
      const configurator = new PCSX2Configurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("pcsx2");
      const pcsx2IniPath = path.join(configDir, "PCSX2.ini");
      expect(fs.existsSync(pcsx2IniPath)).toBe(true);

      const iniText = fs.readFileSync(pcsx2IniPath, "utf-8");
      expect(iniText).toContain("[UI]");
      expect(iniText).toContain("StartFullscreen = false");

      expect(iniText).toContain("[EmuCore/GS]");
      expect(iniText).toContain("upscale_multiplier = 1");

      expect(iniText).toContain("[Pad1]");
      expect(iniText).toContain("Cross = Keyboard/U");
      expect(iniText).toContain("Start = Keyboard/T");
    });
  });

  describe("win32 / Windows Platform Configuration & Translation", () => {
    let winHandler: WinHandler;

    beforeEach(() => {
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

      jest.spyOn(osHandler, "getSavePath").mockImplementation((game) => {
        const appData = path.join(tempDir, "AppData", "Roaming");
        const localAppData = path.join(tempDir, "AppData", "Local");
        const docs = path.join(tempDir, "Documents");

        switch (game.engineId) {
          case "mesen": return path.join(appData, "Mesen2", "Saves");
          case "melonds": return path.dirname(game.filePath);
          case "dolphin": return game.consoleId === "wii" ? path.join(appData, "Dolphin Emulator", "Wii") : path.join(appData, "Dolphin Emulator", "GC");
          case "azahar": return path.join(appData, "Azahar", "sdmc");
          case "ares": return path.join(localAppData, "ares", "Saves");
          case "duckstation": return path.join(docs, "DuckStation", "memcards");
          case "pcsx2": return path.join(docs, "PCSX2", "memcards");
          default: return winHandler.getSavePath(game);
        }
      });
    });

    it("1. Dolphin: should configure Dolphin for win32 with Windows config path, keycode mapping, and dynamic device indexing", async () => {
      const game: Game = {
        id: "wind-waker-win",
        title: "The Legend of Zelda: The Wind Waker",
        filePath: "C:\\roms\\ww.iso",
        consoleId: "gc",
        engineId: "dolphin",
        playtimeSeconds: 0,
        lastPlayedAt: 0,
      };

      const configurator = new DolphinConfigurator(game);
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("dolphin");
      expect(configDir).toContain(path.join("AppData", "Roaming", "Dolphin Emulator", "Config"));

      const gcPadNewPath = path.join(configDir, "GCPadNew.ini");
      expect(fs.existsSync(gcPadNewPath)).toBe(true);

      const gcPadText = fs.readFileSync(gcPadNewPath, "utf-8");
      expect(gcPadText).toContain("Buttons/A = U");
      expect(gcPadText).toContain("Buttons/Start = T");
      expect(gcPadText).toContain("Device = DInput/0/Keyboard Mouse");

      // Test Gamepad profile translation for win32 with dynamic device indexing (e.g. deviceIndex = 1 -> XInput/1/Gamepad)
      const translator = new DolphinTranslator();
      const svc = new ControlsService();
      const baseProfile = svc.getDefaultProfile();
      const layout = await svc.getEffectiveConsoleLayout("gc", baseProfile.id);
      const player1 = layout.player1;
      const patches = translator.translate(
        {
          ...baseProfile,
          player1: {
            ...player1,
            face: {
              ...player1.face,
              primary: { type: "gp_button", token: "GP_A" }
            }
          }
        },
        { platform: "win32", consoleId: "gc", configDir, deviceIndex: 1 }
      );

      const devicePatch = patches.find(p => p.kind === "ini-set" && p.key === "Device");
      expect(devicePatch).toBeDefined();
      if (devicePatch && devicePatch.kind === "ini-set") {
        expect(devicePatch.value).toBe("XInput/0/Gamepad");
      }
    });

    it("2. Mesen: should configure Mesen for win32 with VK keycode mapping in settings.json", async () => {
      const configurator = new MesenConfigurator("nes");
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("mesen");
      expect(configDir).toContain(path.join("AppData", "Roaming", "Mesen2"));

      const settingsJsonPath = path.join(configDir, "settings.json");
      expect(fs.existsSync(settingsJsonPath)).toBe(true);

      const settings = JSON.parse(fs.readFileSync(settingsJsonPath, "utf-8"));
      expect(settings.Nes?.Port1?.Type).toBe("NesController");

      // Verify Win32 VK mapping: 'KeyU' -> 85 (ASCII U), 'KeyT' -> 84 (ASCII T)
      const mapping1 = settings.Nes.Port1.Mapping1;
      expect(mapping1.A).toBe(85);
      expect(mapping1.Start).toBe(84);
    });

    it("3. MelonDS: should configure MelonDS for win32 with AppData path, TOML patch output, and joystick ID", async () => {
      const configurator = new MelonDSConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("melonds");
      expect(configDir).toContain(path.join("AppData", "Local", "melonDS"));

      const melonTomlPath = path.join(configDir, "melonDS.toml");
      expect(fs.existsSync(melonTomlPath)).toBe(true);

      const tomlText = fs.readFileSync(melonTomlPath, "utf-8");
      expect(tomlText).toContain("[Instance0]");
      expect(tomlText).toContain("Key_A = 85");
      expect(tomlText).toContain("Key_Start = 84");
      expect(tomlText).toContain("JoystickID = 0");
    });

    it("4. Azahar: should configure Azahar for win32 with AppData path and QT ini keycode mapping", async () => {
      const configurator = new AzaharConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("azahar");
      expect(configDir).toContain(path.join("AppData", "Roaming", "Azahar", "config"));

      const qtIniPath = path.join(configDir, "qt-config.ini");
      expect(fs.existsSync(qtIniPath)).toBe(true);

      const iniText = fs.readFileSync(qtIniPath, "utf-8");
      expect(iniText).toContain("profiles\\1\\button_a=\"code:85,engine:keyboard\"");
      expect(iniText).toContain("profiles\\1\\button_start=\"code:84,engine:keyboard\"");
    });

    it("5. Ares: should configure Ares for win32 with AppData/Local path, VK keycode mapping, and dynamic gamepad device indexing", async () => {
      jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(null);

      const configurator = new AresConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("ares");
      expect(configDir).toContain(path.join("AppData", "Local", "ares"));

      const settingsBmlPath = path.join(configDir, "settings.bml");
      expect(fs.existsSync(settingsBmlPath)).toBe(true);

      const bmlText = fs.readFileSync(settingsBmlPath, "utf-8");
      // On win32, Ares indexes into its rawinput key list (see ares/ruby/input/keyboard/rawinput.cpp):
      // KeyU -> 55, KeyT -> 54, ArrowUp -> 86, Digit3 -> 18
      expect(bmlText).toContain("A..South: 0x1/0/55;;");
      expect(bmlText).toContain("Start: 0x1/0/54;;");
      expect(bmlText).toContain("R-Up: 0x1/0/86;;");
      expect(bmlText).toContain("Pad.Up: 0x1/0/18;;");

      // Verify gamepad bindings use the probed device id and the raw button index from probed binds.
      const translator = new AresTranslator();
      const svc = new ControlsService();
      const profile = svc.getDefaultProfile();
      const layout = await svc.getEffectiveConsoleLayout("n64", profile.id);
      const player1 = layout.player1;
      const updates = translator.translateFromPlayer(
        {
          ...player1,
          face: {
            ...player1.face,
            primary: { type: "gp_button", token: "GP_A" }
          }
        },
        "win32",
        "0x54c0ce6",
        { GP_A: { kind: "button", button: 0 } }
      );
      expect(updates["A..South"]).toBe("0x54c0ce6/3/0;;");
    });

    it("6. DuckStation: should configure DuckStation for win32 with Documents path and dynamic SDL device indexing", async () => {
      const configurator = new DuckStationConfigurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorBasePath("duckstation");
      expect(configDir).toContain(path.join("Documents", "DuckStation"));

      const settingsIniPath = DuckStation.iniPath(configDir);
      expect(fs.existsSync(settingsIniPath)).toBe(true);

      const iniText = fs.readFileSync(settingsIniPath, "utf-8");
      expect(iniText).toContain("Cross = Keyboard/U");
      expect(iniText).toContain("Start = Keyboard/T");

      // Verify dynamic device indexing on win32 (e.g. deviceIndex = 2 -> SDL-2/A)
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
            face: {
              ...player1.face,
              primary: { type: "gp_button", token: "GP_A" }
            }
          }
        },
        { platform: "win32", configDir }
      );

      const crossPatch = patches.find(p => p.kind === "ini-set" && p.key === "Cross");
      expect(crossPatch).toBeDefined();
      if (crossPatch && crossPatch.kind === "ini-set") {
        expect(crossPatch.value).toBe("SDL-0/A");
      }
    });

    it("7. PCSX2: should configure PCSX2 for win32 with Documents path and dynamic SDL device indexing", async () => {
      const configurator = new PCSX2Configurator();
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("pcsx2");
      expect(configDir).toContain(path.join("Documents", "PCSX2", "inis"));

      const pcsx2IniPath = path.join(configDir, "PCSX2.ini");
      expect(fs.existsSync(pcsx2IniPath)).toBe(true);

      const iniText = fs.readFileSync(pcsx2IniPath, "utf-8");
      expect(iniText).toContain("Cross = Keyboard/U");
      expect(iniText).toContain("Start = Keyboard/T");

      // Verify dynamic device indexing on win32 (e.g. deviceIndex = 3 -> SDL-3/FaceSouth)
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
            face: {
              ...player1.face,
              primary: { type: "gp_button", token: "GP_A" }
            }
          }
        },
        { platform: "win32", configDir, deviceIndex: 3 }
      );

      const crossPatch = patches.find(p => p.kind === "ini-set" && p.key === "Cross");
      expect(crossPatch).toBeDefined();
      if (crossPatch && crossPatch.kind === "ini-set") {
        expect(crossPatch.value).toBe("SDL-0/FaceSouth");
      }
    });
  });
});
