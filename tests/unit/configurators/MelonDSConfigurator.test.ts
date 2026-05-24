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
import { MelonDSConfigurator } from "../../../src/main/utils/configurators/MelonDSConfigurator";

describe("MelonDSConfigurator", () => {
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

  it("should configure MelonDSConfigurator", async () => {
    const configurator = new MelonDSConfigurator();
    await configurator.configure();

    const melonToml = path.join(tempDir, "Library/Preferences/melonDS/melonDS.toml");
    expect(fs.existsSync(melonToml)).toBe(true);

    const tomlText = fs.readFileSync(melonToml, "utf-8");
    // Verify specific sections and parameters
    expect(tomlText).toContain("[Instance0]");
    expect(tomlText).toContain("JoystickID = 0");
    expect(tomlText).toContain("Key_A = 85");
    expect(tomlText).toContain("Key_Start = 84");

    expect(tomlText).toContain("[Instance0.Keyboard]");
    expect(tomlText).toContain("A = 85");
    expect(tomlText).toContain("Start = 84");
    expect(tomlText).toContain("Up = 51");
  });
});
