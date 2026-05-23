jest.mock("os", () => {
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
  });
});
