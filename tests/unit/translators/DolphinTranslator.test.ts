import { DolphinTranslator } from "../../../src/main/utils/translators/DolphinTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

describe("DolphinTranslator", () => {
  const profile: ControlsProfile = {
    id: "test-profile-id",
    name: "Test Profile",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    ...createDefaultProfileShape()
  };

  const context: TranslateContext = {
    platform: "darwin",
    configDir: "/mock/config/dir",
    consoleId: "gc",
  };

  it("should translate bindings via DolphinTranslator correctly", () => {
    const translator = new DolphinTranslator();
    const result = translator.translate(profile, context);
    expect(result.length).toBeGreaterThan(0);

    // Verify key mappings for GC
    // face.primary is 'KeyU' -> 'U'
    const buttonA = result.find(p => p.kind === "ini-set" && p.key === "Buttons/A");
    expect(buttonA).toBeDefined();
    if (buttonA && buttonA.kind === "ini-set") {
      expect(buttonA.value).toBe("U");
    }

    // system.start is 'KeyT' -> 'T'
    const buttonStart = result.find(p => p.kind === "ini-set" && p.key === "Buttons/Start");
    expect(buttonStart).toBeDefined();
    if (buttonStart && buttonStart.kind === "ini-set") {
      expect(buttonStart.value).toBe("T");
    }

    // dpad.up is 'Digit3' -> '3'
    const buttonUp = result.find(p => p.kind === "ini-set" && p.key === "D-Pad/Up");
    expect(buttonUp).toBeDefined();
    if (buttonUp && buttonUp.kind === "ini-set") {
      expect(buttonUp.value).toBe("3");
    }

    // move.up is 'KeyW' -> 'W'
    const stickUp = result.find(p => p.kind === "ini-set" && p.key === "Main Stick/Up");
    expect(stickUp).toBeDefined();
    if (stickUp && stickUp.kind === "ini-set") {
      expect(stickUp.value).toBe("W");
    }
  });

  it("should translate bindings via DolphinTranslator for Wii console correctly", () => {
    const wiiContext: TranslateContext = {
      platform: "darwin",
      configDir: "/mock/config/dir",
      consoleId: "wii",
    };
    const translator = new DolphinTranslator();
    const result = translator.translate(profile, wiiContext);

    // Verify key mappings for Wii Classic Controller extension
    // face.primary is 'KeyU' -> 'U'
    const buttonAWii = result.find(p => p.kind === "ini-set" && p.key === "Classic/Buttons/A");
    expect(buttonAWii).toBeDefined();
    if (buttonAWii && buttonAWii.kind === "ini-set") {
      expect(buttonAWii.value).toBe("U");
    }

    // system.start is 'KeyT' -> 'T' -> maps to '+' on classic controller
    const buttonPlus = result.find(p => p.kind === "ini-set" && p.key === "Classic/Buttons/+");
    expect(buttonPlus).toBeDefined();
    if (buttonPlus && buttonPlus.kind === "ini-set") {
      expect(buttonPlus.value).toBe("T");
    }
  });

  it("should translate gamepad bindings and GC Z-button correctly", () => {
    const gamepadProfile: ControlsProfile = {
      ...profile,
      preferredControllerId: "SDL/0/Controller",
      player1: {
        ...profile.player1,
        face: {
          type: "face",
          primary: { type: "gp_button", token: "GP_A" },
          secondary: { type: "gp_button", token: "GP_B" },
          tertiary: { type: "gp_button", token: "GP_X" },
          quaternary: { type: "gp_button", token: "GP_Y" },
        },
        system: {
          type: "system",
          start: { type: "gp_button", token: "GP_START" },
        },
        special: {
          type: "gc",
          z: { type: "gp_button", token: "GP_SELECT" },
        }
      }
    };

    const translator = new DolphinTranslator();
    const result = translator.translate(gamepadProfile, context);
    expect(result.length).toBeGreaterThan(0);

    // Verify Device matches the preferredControllerId
    const devicePatch = result.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(devicePatch).toBeDefined();
    if (devicePatch && devicePatch.kind === "ini-set") {
      expect(devicePatch.value).toBe("SDL/0/Controller");
    }

    // Buttons/A should be mapped to `Button A`
    const buttonA = result.find(p => p.kind === "ini-set" && p.key === "Buttons/A");
    expect(buttonA).toBeDefined();
    if (buttonA && buttonA.kind === "ini-set") {
      expect(buttonA.value).toBe("`Button A`");
    }

    // Buttons/Z should be mapped to `Back` (token GP_SELECT)
    const buttonZ = result.find(p => p.kind === "ini-set" && p.key === "Buttons/Z");
    expect(buttonZ).toBeDefined();
    if (buttonZ && buttonZ.kind === "ini-set") {
      expect(buttonZ.value).toBe("`Back`");
    }
  });

  it("should handle Wii special home bindings and detect device correctly", () => {
    const wiiContext: TranslateContext = {
      platform: "darwin",
      configDir: "/mock/config/dir",
      consoleId: "wii",
    };
    const wiiProfile: ControlsProfile = {
      ...profile,
      preferredControllerId: "SDL/0/Controller",
      player1: {
        ...profile.player1,
        special: {
          type: "wii",
          home: { type: "gp_button", token: "GP_START" },
        }
      }
    };
    const translator = new DolphinTranslator();
    const result = translator.translate(wiiProfile, wiiContext);
    expect(result.length).toBeGreaterThan(0);

    // Verify Device matches the preferredControllerId because home is a gamepad button
    const devicePatch = result.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(devicePatch).toBeDefined();
    if (devicePatch && devicePatch.kind === "ini-set") {
      expect(devicePatch.value).toBe("SDL/0/Controller");
    }
  });
});
