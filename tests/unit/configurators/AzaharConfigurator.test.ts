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
import { AzaharConfigurator } from "../../../src/main/utils/configurators/AzaharConfigurator";

describe("AzaharConfigurator", () => {
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

  it("should configure AzaharConfigurator", async () => {
    const configurator = new AzaharConfigurator();
    await configurator.configure();

    const qtIni = path.join(tempDir, "Library/Application Support/Azahar/config/qt-config.ini");
    expect(fs.existsSync(qtIni)).toBe(true);

    const iniText = fs.readFileSync(qtIni, "utf-8");
    // Verify specific sections and parameters
    expect(iniText).toContain("[Controls]");
    expect(iniText).toContain("profiles\\1\\button_a=\"code:85,engine:keyboard\"");
    expect(iniText).toContain("profiles\\1\\button_start=\"code:84,engine:keyboard\"");

    expect(iniText).toContain("[UI]");
    expect(iniText).toContain("confirmClose=false");
    expect(iniText).toContain("fullscreen=false");

    expect(iniText).toContain("[Renderer]");
    expect(iniText).toContain("resolution_factor=1");

    expect(iniText).toContain("[Miscellaneous]");
    expect(iniText).toContain("check_for_update_on_start=false");
  });
});
