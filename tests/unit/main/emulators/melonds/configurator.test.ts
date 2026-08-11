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
import { MelonDSConfigurator } from "../../../../../src/main/emulators/melonds/configurator";
import { osHandler } from "../../../../../src/main/platform";
import { EngineService } from "../../../../../src/main/services/EngineService";

describe("MelonDSConfigurator", () => {
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

  it("should configure MelonDSConfigurator", async () => {
    const configurator = new MelonDSConfigurator();
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("melonds");
    const melonToml = path.join(configDir, "melonDS.toml");
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

  describe("on win32, against a portable install", () => {
    // The official Windows melonDS release is a portable build: it reads and
    // writes its config next to melonDS.exe, not %LOCALAPPDATA%\melonDS - a
    // real installed copy was found doing exactly this. If RomBox keeps
    // writing to the OS-standard path instead, melonDS never sees the
    // bindings and controls silently do nothing.
    it("writes the config next to the installed binary instead of the OS-standard path", async () => {
      jest.spyOn(osHandler, "getPlatform").mockReturnValue("win32");

      const engineDir = path.join(tempDir, "engines", "melonds");
      const osConfigDir = path.join(tempDir, "os-standard", "melonDS");
      fs.mkdirSync(engineDir, { recursive: true });
      const enginePath = path.join(engineDir, "melonDS.exe");
      fs.writeFileSync(enginePath, "");
      jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(enginePath);
      jest.spyOn(osHandler, "getEmulatorConfigPath").mockReturnValue(osConfigDir);

      await new MelonDSConfigurator().configure();

      const portableToml = path.join(engineDir, "melonDS.toml");
      const osStandardToml = path.join(osConfigDir, "melonDS.toml");

      expect(fs.existsSync(portableToml)).toBe(true);
      expect(fs.existsSync(osStandardToml)).toBe(false);

      const tomlText = fs.readFileSync(portableToml, "utf-8");
      expect(tomlText).toContain("Key_A = 85");

      jest.restoreAllMocks();
    });

    it("prefers an existing OS-standard config over the engine directory if that's where a prior run wrote", async () => {
      jest.spyOn(osHandler, "getPlatform").mockReturnValue("win32");

      const engineDir = path.join(tempDir, "engines", "melonds");
      const osConfigDir = path.join(tempDir, "os-standard", "melonDS");
      fs.mkdirSync(engineDir, { recursive: true });
      const enginePath = path.join(engineDir, "melonDS.exe");
      fs.writeFileSync(enginePath, "");
      jest.spyOn(EngineService, "getEnginePath").mockResolvedValue(enginePath);
      jest.spyOn(osHandler, "getEmulatorConfigPath").mockReturnValue(osConfigDir);

      fs.mkdirSync(osConfigDir, { recursive: true });
      fs.writeFileSync(path.join(osConfigDir, "melonDS.toml"), "# pre-existing\n[Instance0]\n");

      await new MelonDSConfigurator().configure();

      expect(fs.existsSync(path.join(osConfigDir, "melonDS.toml"))).toBe(true);
      expect(fs.existsSync(path.join(engineDir, "melonDS.toml"))).toBe(false);

      jest.restoreAllMocks();
    });
  });
});
