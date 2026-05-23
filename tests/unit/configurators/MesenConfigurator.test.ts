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
import { MesenConfigurator } from "../../../src/main/utils/configurators/MesenConfigurator";

describe("MesenConfigurator", () => {
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

  it("should configure MesenConfigurator", async () => {
    const configurator = new MesenConfigurator("nes");
    await configurator.configure();

    const settingsJson = path.join(tempDir, "Library/Application Support/Mesen2/settings.json");
    expect(fs.existsSync(settingsJson)).toBe(true);

    const text = fs.readFileSync(settingsJson, "utf-8");
    const settings = JSON.parse(text);

    // Verify Nes Port1 Configuration
    expect(settings.Nes).toBeDefined();
    expect(settings.Nes.Port1).toBeDefined();
    expect(settings.Nes.Port1.Type).toBe("NesController");

    // Mapping1: keyboard device with "move" dirSource
    const mapping1 = settings.Nes.Port1.Mapping1;
    expect(mapping1).toBeDefined();
    // face.primary 'KeyU' -> A -> 64
    expect(mapping1.A).toBe(64);
    // system.start 'KeyT' -> Start -> 63
    expect(mapping1.Start).toBe(63);
    // move.up 'KeyW' -> Up -> 66
    expect(mapping1.Up).toBe(66);
  });
});
