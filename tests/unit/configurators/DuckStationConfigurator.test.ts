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
import { DuckStationConfigurator } from "../../../src/main/utils/configurators/DuckStationConfigurator";

describe("DuckStationConfigurator", () => {
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

  it("should configure DuckStationConfigurator", async () => {
    const configurator = new DuckStationConfigurator();
    await configurator.configure();

    const settingsIni = path.join(tempDir, "Library/Application Support/DuckStation/settings.ini");
    expect(fs.existsSync(settingsIni)).toBe(true);

    const iniText = fs.readFileSync(settingsIni, "utf-8");
    // Verify specific sections and parameters
    expect(iniText).toContain("[Main]");
    expect(iniText).toContain("StartFullscreen = false");
    expect(iniText).toContain("SaveStateOnExit = true");

    expect(iniText).toContain("[GPU]");
    expect(iniText).toContain("ResolutionScale = 1");

    expect(iniText).toContain("[Display]");
    expect(iniText).toContain("Fullscreen = false");
    expect(iniText).toContain("AspectRatio = Auto");

    expect(iniText).toContain("[Pad1]");
    expect(iniText).toContain("Cross = Keyboard/U");
    expect(iniText).toContain("Start = Keyboard/T");
    expect(iniText).toContain("Up = Keyboard/3");
  });
});
