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
import { AresConfigurator } from "../../../src/main/utils/configurators/AresConfigurator";
import { EngineService } from "../../../src/main/services/EngineService";

describe("AresConfigurator", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");

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
  });

  it("should configure AresConfigurator in fallback/non-portable mode", async () => {
    jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(null);
    const configurator = new AresConfigurator();
    await configurator.configure();
    
    // In fallback mode, it writes to the standard Application Support location
    const settingsBml = path.join(tempDir, "Library/Application Support/ares/settings.bml");
    expect(fs.existsSync(settingsBml)).toBe(true);
  });
});
