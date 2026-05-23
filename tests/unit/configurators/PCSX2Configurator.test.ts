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
import { PCSX2Configurator } from "../../../src/main/utils/configurators/PCSX2Configurator";

describe("PCSX2Configurator", () => {
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

  it("should configure PCSX2Configurator", async () => {
    const configurator = new PCSX2Configurator();
    await configurator.configure();

    const pcsx2Ini = path.join(tempDir, "Library/Application Support/PCSX2/inis/PCSX2.ini");
    expect(fs.existsSync(pcsx2Ini)).toBe(true);

    const iniText = fs.readFileSync(pcsx2Ini, "utf-8");
    // Verify specific sections and parameters
    expect(iniText).toContain("[UI]");
    expect(iniText).toContain("StartFullscreen = false");
    expect(iniText).toContain("ConfirmShutdown = false");

    expect(iniText).toContain("[EmuCore/GS]");
    expect(iniText).toContain("upscale_multiplier = 1");

    expect(iniText).toContain("[Pad1]");
    expect(iniText).toContain("Cross = Keyboard/U");
    expect(iniText).toContain("Start = Keyboard/T");
    expect(iniText).toContain("Up = Keyboard/3");
  });
});
