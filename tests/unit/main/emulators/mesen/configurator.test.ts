jest.mock("os", () => {
  return {
    ...jest.requireActual("os"),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    homedir: () => require("../../../../helpers/tempDirs").suiteUserDataDir(),
  };
});

// getSdlProbePath must resolve to a real file - MesenConfigurator gates on
// fs.existsSync before ever invoking (the mocked) runSdlProbe. Using this test
// file itself is fine since runSdlProbe is mocked and never actually executes it.
jest.mock("../../../../../src/main/services/EngineService", () => ({
  ...jest.requireActual("../../../../../src/main/services/EngineService"),
  getSdlProbePath: jest.fn(() => __filename),
  installSdlProbe: jest.fn(() => ({ ok: true, dest: __filename })),
}));

jest.mock("../../../../../src/main/emulators/azahar/sdlProbe", () => ({
  runSdlProbe: jest.fn(),
}));

import { suiteUserDataDir } from "../../../../helpers/tempDirs";
import path from "path";
import fs from "fs";
import { initDB } from "../../../../../src/main/data/db";
import { MesenConfigurator } from "../../../../../src/main/emulators/mesen/configurator";
import { osHandler } from "../../../../../src/main/platform";
import { runSdlProbe } from "../../../../../src/main/emulators/azahar/sdlProbe";
import { controlsService } from "../../../../../src/main/services/ControlsService";

describe("MesenConfigurator", () => {
  const tempDir = suiteUserDataDir();

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();
    // the expected keycodes below are macOS ones; pin the platform so this
    // test is deterministic regardless of which OS actually runs it.
    jest.spyOn(osHandler, "getPlatform").mockReturnValue("darwin");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should configure MesenConfigurator", async () => {
    const configurator = new MesenConfigurator("nes");
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("mesen");
    const settingsJson = path.join(configDir, "settings.json");
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

  describe("DirectInput fallback probing on win32", () => {
    const mockedRunSdlProbe = runSdlProbe as jest.Mock;

    beforeEach(() => {
      jest.spyOn(osHandler, "getPlatform").mockReturnValue("win32");
      mockedRunSdlProbe.mockReset();
    });

    function bindPlayer1ToGamepad() {
      const profile = controlsService.getDefaultProfile();
      controlsService.saveProfile({
        ...profile,
        player1: {
          ...profile.player1,
          face: {
            ...profile.player1.face,
            primary: { type: "gp_button", token: "GP_A" },
          },
          dpad: {
            type: "dpad",
            up: { type: "gp_button", token: "GP_DPAD_UP" },
            down: { type: "gp_button", token: "GP_DPAD_DOWN" },
            left: { type: "gp_button", token: "GP_DPAD_LEFT" },
            right: { type: "gp_button", token: "GP_DPAD_RIGHT" },
          },
        },
      });
    }

    it("probes and applies the learned raw button index to Mapping4 when a player is gamepad-bound", async () => {
      bindPlayer1ToGamepad();
      mockedRunSdlProbe.mockReturnValue({
        learned: { ok: true, guid: "fake-guid", port: 0, binds: { GP_A: { kind: "button", button: 1 } } },
        rawStdout: "",
        rawStderr: "",
        exitCode: 0,
      });

      const configurator = new MesenConfigurator("nes");
      await configurator.configure();

      expect(mockedRunSdlProbe).toHaveBeenCalledTimes(1);

      const configDir = osHandler.getEmulatorConfigPath("mesen");
      const settings = JSON.parse(fs.readFileSync(path.join(configDir, "settings.json"), "utf-8"));

      // Mapping3 stays XInput (GP_A -> BASE_GAMEPAD + 13), Mapping4 becomes
      // DirectInput using the probed raw button index (0x2000 + 16 + 1).
      expect(settings.Nes.Port1.Mapping3.A).toBe(0x1000 + 13);
      expect(settings.Nes.Port1.Mapping4.A).toBe(0x2000 + 16 + 1);
    });

    it("does not probe when no player is bound to a gamepad", async () => {
      const configurator = new MesenConfigurator("nes");
      await configurator.configure();

      expect(mockedRunSdlProbe).not.toHaveBeenCalled();
    });

    it("does not probe on darwin even when a player is gamepad-bound", async () => {
      bindPlayer1ToGamepad();
      jest.spyOn(osHandler, "getPlatform").mockReturnValue("darwin");

      const configurator = new MesenConfigurator("nes");
      await configurator.configure();

      expect(mockedRunSdlProbe).not.toHaveBeenCalled();
    });

    it("still binds fixed dpad codes and the static button fallback when the probe fails", async () => {
      bindPlayer1ToGamepad();
      mockedRunSdlProbe.mockImplementation(() => {
        throw new Error("probe helper crashed");
      });

      const configurator = new MesenConfigurator("nes");
      await configurator.configure();

      const configDir = osHandler.getEmulatorConfigPath("mesen");
      const settings = JSON.parse(fs.readFileSync(path.join(configDir, "settings.json"), "utf-8"));

      // No learned button index for A, but the common-PlayStation-pad fallback
      // (raw index 1, GP_A) and dpad directions don't need probe data at all.
      expect(settings.Nes.Port1.Mapping4.A).toBe(0x2000 + 16 + 1);
      expect(settings.Nes.Port1.Mapping4.Up).toBe(0x2000 + 12);
    });
  });
});
