jest.mock("os", () => {
  return {
    ...jest.requireActual("os"),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    homedir: () => require("../../../../helpers/tempDirs").suiteUserDataDir(),
  };
});

import { suiteUserDataDir } from "../../../../helpers/tempDirs";
import path from "path";
import fs from "fs";
import { initDB } from "../../../../../src/main/data/db";
import { AresConfigurator } from "../../../../../src/main/emulators/ares/configurator";
import { EngineService } from "../../../../../src/main/services/EngineService";
import { osHandler } from "../../../../../src/main/platform";

describe("AresConfigurator", () => {
  const tempDir = suiteUserDataDir();

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

  it("should configure AresConfigurator in portable mode", async () => {
    const aresBin = path.join(tempDir, "engines/ares/ares.app/Contents/MacOS/ares");
    jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(aresBin);
    const configurator = new AresConfigurator();
    await configurator.configure();
    
    // In portable mode, settings.bml is written inside the engine folder
    const settingsBml = path.join(tempDir, "engines/ares/settings.bml");
    expect(fs.existsSync(settingsBml)).toBe(true);

    const bmlText = fs.readFileSync(settingsBml, "utf-8");
    expect(bmlText).toContain("VirtualPad1");
    // Verify specific mapped keys
    expect(bmlText).toContain("Pad.Up: 0x1/0/24;;");
    expect(bmlText).toContain("Start: 0x1/0/59;;");
    expect(bmlText).toContain("A..South: 0x1/0/60;;");
    expect(bmlText).toContain("L-Up: 0x1/0/62;;");
  });

  it("should configure AresConfigurator in fallback/non-portable mode", async () => {
    jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(null);
    const configurator = new AresConfigurator();
    await configurator.configure();
    
    // In fallback mode, it writes to the standard Application Support location
    const settingsBml = path.join(osHandler.getEmulatorConfigPath("ares"), "settings.bml");
    expect(fs.existsSync(settingsBml)).toBe(true);

    const bmlText = fs.readFileSync(settingsBml, "utf-8");
    expect(bmlText).toContain("VirtualPad1");
    expect(bmlText).toContain("Pad.Up: 0x1/0/24;;");
    expect(bmlText).toContain("Start: 0x1/0/59;;");
  });
});
