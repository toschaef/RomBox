jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../../temp-userdata"),
  };
});

import path from "path";
import fs from "fs";
import { initDB } from "../../../src/main/data/db";
import { DolphinConfigurator } from "../../../src/main/utils/configurators/DolphinConfigurator";
import type { Game } from "../../../src/shared/types";

describe("DolphinConfigurator", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should configure DolphinConfigurator for GC", async () => {
    const game: Game = {
      id: "wind-waker",
      title: "The Legend of Zelda: The Wind Waker",
      filePath: "/roms/ww.iso",
      consoleId: "gc",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const dolphinIni = path.join(tempDir, "Library/Application Support/Dolphin/Config/Dolphin.ini");
    expect(fs.existsSync(dolphinIni)).toBe(true);
    const dolphinText = fs.readFileSync(dolphinIni, "utf-8");
    expect(dolphinText).toContain("RenderToMain = False");
    expect(dolphinText).toContain("Fullscreen = False");

    const gfxIni = path.join(tempDir, "Library/Application Support/Dolphin/Config/GFX.ini");
    expect(fs.existsSync(gfxIni)).toBe(true);
    const gfxText = fs.readFileSync(gfxIni, "utf-8");
    expect(gfxText).toContain("InternalResolution = 1");

    const gcPadNew = path.join(tempDir, "Library/Application Support/Dolphin/Config/GCPadNew.ini");
    expect(fs.existsSync(gcPadNew)).toBe(true);
    const gcPadText = fs.readFileSync(gcPadNew, "utf-8");
    // GCPad1 face.primary 'KeyU' -> 'U'
    expect(gcPadText).toContain("Buttons/A = U");
    // GCPad1 system.start 'KeyT' -> 'T'
    expect(gcPadText).toContain("Buttons/Start = T");
  });

  it("should configure DolphinConfigurator for Wii", async () => {
    const game: Game = {
      id: "mario-galaxy",
      title: "Super Mario Galaxy",
      filePath: "/roms/smg.iso",
      consoleId: "wii",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const dolphinIni = path.join(tempDir, "Library/Application Support/Dolphin/Config/Dolphin.ini");
    expect(fs.existsSync(dolphinIni)).toBe(true);
    const dolphinText = fs.readFileSync(dolphinIni, "utf-8");
    expect(dolphinText).toContain("WiimoteSource0 = 1");

    const wiimoteNew = path.join(tempDir, "Library/Application Support/Dolphin/Config/WiimoteNew.ini");
    expect(fs.existsSync(wiimoteNew)).toBe(true);
    const wiiText = fs.readFileSync(wiimoteNew, "utf-8");
    expect(wiiText).toContain("Extension = Classic");
    expect(wiiText).toContain("Classic/Buttons/A = U");
    expect(wiiText).toContain("Classic/Buttons/+ = T");
  });
});
