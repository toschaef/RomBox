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
import { AzaharConfigurator } from "../../../../../src/main/emulators/azahar/configurator";
import { osHandler } from "../../../../../src/main/platform";

describe("AzaharConfigurator", () => {
  const tempDir = suiteUserDataDir();

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

    const configDir = osHandler.getEmulatorConfigPath("azahar");
    const qtIni = path.join(configDir, "qt-config.ini");
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
