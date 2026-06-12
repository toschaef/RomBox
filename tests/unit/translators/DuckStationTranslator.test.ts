import { DuckStationTranslator } from "../../../src/main/utils/translators/DuckStationTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

describe("DuckStationTranslator", () => {
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
    consoleId: "ps1",
  };

  it("should translate bindings via DuckStationTranslator correctly", () => {
    const translator = new DuckStationTranslator();
    const result = translator.translate(profile, context);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].kind).toBe("ini-set");

    // Verify key mappings
    // face.primary is 'KeyU' -> 'Keyboard/U'
    const buttonCross = result.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(buttonCross).toBeDefined();
    if (buttonCross && buttonCross.kind === "ini-set") {
      expect(buttonCross.value).toBe("Keyboard/U");
    }

    // system.start is 'KeyT' -> 'Keyboard/T'
    const buttonStart = result.find(p => p.kind === "ini-set" && p.key === "Start");
    expect(buttonStart).toBeDefined();
    if (buttonStart && buttonStart.kind === "ini-set") {
      expect(buttonStart.value).toBe("Keyboard/T");
    }

    // dpad.up is 'Digit3' -> 'Keyboard/3'
    const buttonUp = result.find(p => p.kind === "ini-set" && p.key === "Up");
    expect(buttonUp).toBeDefined();
    if (buttonUp && buttonUp.kind === "ini-set") {
      expect(buttonUp.value).toBe("Keyboard/3");
    }

    // move.up is 'KeyW' -> 'Keyboard/W'
    const stickLUp = result.find(p => p.kind === "ini-set" && p.key === "LUp");
    expect(stickLUp).toBeDefined();
    if (stickLUp && stickLUp.kind === "ini-set") {
      expect(stickLUp.value).toBe("Keyboard/W");
    }
  });

  it("should translate gamepad bindings via DuckStationTranslator correctly", () => {
    const gamepadProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        face: {
          type: "face",
          primary: { type: "gp_button", token: "GP_A" },
          secondary: { type: "gp_button", token: "GP_B" },
        },
        move: {
          type: "stick",
          stick: "left",
          deadzone: 0.15,
        }
      }
    };
    
    const translator = new DuckStationTranslator();
    const result = translator.translate(gamepadProfile, context);
    expect(result.length).toBeGreaterThan(0);

    // GP_A maps to SDL-0/A
    const buttonCross = result.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(buttonCross).toBeDefined();
    if (buttonCross && buttonCross.kind === "ini-set") {
      expect(buttonCross.value).toBe("SDL-0/A");
    }

    // GP_B maps to SDL-0/B
    const buttonCircle = result.find(p => p.kind === "ini-set" && p.key === "Circle");
    expect(buttonCircle).toBeDefined();
    if (buttonCircle && buttonCircle.kind === "ini-set") {
      expect(buttonCircle.value).toBe("SDL-0/B");
    }

    // Left analog stick Up direction maps to gp_axis_digital, which translates to SDL-0/+LeftY or SDL-0/-LeftY
    const stickLUp = result.find(p => p.kind === "ini-set" && p.key === "LUp");
    expect(stickLUp).toBeDefined();
    if (stickLUp && stickLUp.kind === "ini-set") {
      expect(stickLUp.value).toBe("SDL-0/+LeftY"); // normal UP for Left stick is GP_LS_UP (positive sign in GP_LS_UP)
    }
  });
});
