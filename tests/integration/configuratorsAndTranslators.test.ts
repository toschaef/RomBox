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
import { initDB } from "../../src/main/data/db";
import { DolphinConfigurator } from "../../src/main/utils/configurators/DolphinConfigurator";
import { MesenConfigurator } from "../../src/main/utils/configurators/MesenConfigurator";
import { MelonDSConfigurator } from "../../src/main/utils/configurators/MelonDSConfigurator";
import { AzaharConfigurator } from "../../src/main/utils/configurators/AzaharConfigurator";
import { AresConfigurator } from "../../src/main/utils/configurators/AresConfigurator";
import { DuckStationConfigurator } from "../../src/main/utils/configurators/DuckStationConfigurator";
import { PCSX2Configurator } from "../../src/main/utils/configurators/PCSX2Configurator";
import { EngineService } from "../../src/main/services/EngineService";
import type { Game } from "../../src/shared/types";

describe("Configurator and Translator Pairs Integration Tests", () => {
  const tempDir = path.resolve(__dirname, "../temp-userdata");

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

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

    // Verify written Dolphin.ini
    const dolphinIniPath = path.join(tempDir, "Library/Application Support/Dolphin/Config/Dolphin.ini");
    expect(fs.existsSync(dolphinIniPath)).toBe(true);
    const dolphinText = fs.readFileSync(dolphinIniPath, "utf-8");
    expect(dolphinText).toContain("RenderToMain = False");
    expect(dolphinText).toContain("Fullscreen = False");

    // Verify written GFX.ini
    const gfxIniPath = path.join(tempDir, "Library/Application Support/Dolphin/Config/GFX.ini");
    expect(fs.existsSync(gfxIniPath)).toBe(true);
    const gfxText = fs.readFileSync(gfxIniPath, "utf-8");
    expect(gfxText).toContain("InternalResolution = 1");

    // Verify written GCPadNew.ini (mapped buttons)
    const gcPadNewPath = path.join(tempDir, "Library/Application Support/Dolphin/Config/GCPadNew.ini");
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

    // Verify written Dolphin.ini
    const dolphinIniPath = path.join(tempDir, "Library/Application Support/Dolphin/Config/Dolphin.ini");
    expect(fs.existsSync(dolphinIniPath)).toBe(true);
    const dolphinText = fs.readFileSync(dolphinIniPath, "utf-8");
    expect(dolphinText).toContain("WiimoteSource0 = 1");

    // Verify written WiimoteNew.ini (Wii controls with Classic extension)
    const wiimoteNewPath = path.join(tempDir, "Library/Application Support/Dolphin/Config/WiimoteNew.ini");
    expect(fs.existsSync(wiimoteNewPath)).toBe(true);
    const wiiText = fs.readFileSync(wiimoteNewPath, "utf-8");
    expect(wiiText).toContain("Extension = Classic");
    expect(wiiText).toContain("Classic/Buttons/A = U");
    expect(wiiText).toContain("Classic/Buttons/+ = T");
  });

  it("should configure MesenConfigurator (NES) and MesenTranslator correctly", async () => {
    const configurator = new MesenConfigurator("nes");
    await configurator.configure();

    const settingsJsonPath = path.join(tempDir, "Library/Application Support/Mesen2/settings.json");
    expect(fs.existsSync(settingsJsonPath)).toBe(true);

    const text = fs.readFileSync(settingsJsonPath, "utf-8");
    const settings = JSON.parse(text);

    expect(settings.Nes).toBeDefined();
    expect(settings.Nes.Port1).toBeDefined();
    expect(settings.Nes.Port1.Type).toBe("NesController");

    const mapping1 = settings.Nes.Port1.Mapping1;
    expect(mapping1).toBeDefined();
    expect(mapping1.A).toBe(64); // 'KeyU' -> A -> 64
    expect(mapping1.Start).toBe(63); // 'KeyT' -> Start -> 63
  });

  it("should configure MesenConfigurator (SNES) and MesenTranslator correctly", async () => {
    const configurator = new MesenConfigurator("snes");
    await configurator.configure();

    const settingsJsonPath = path.join(tempDir, "Library/Application Support/Mesen2/settings.json");
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

    const melonTomlPath = path.join(tempDir, "Library/Preferences/melonDS/melonDS.toml");
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

    const qtIniPath = path.join(tempDir, "Library/Application Support/Azahar/config/qt-config.ini");
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

    const settingsBmlPath = path.join(tempDir, "Library/Application Support/ares/settings.bml");
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

    const settingsIniPath = path.join(tempDir, "Library/Application Support/DuckStation/settings.ini");
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

    const pcsx2IniPath = path.join(tempDir, "Library/Application Support/PCSX2/inis/PCSX2.ini");
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
