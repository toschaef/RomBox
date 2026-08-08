import { DuckStationTranslator } from "../../../../../src/main/emulators/duckstation/translator";
import { createDefaultProfileShape } from "../../../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../../../src/shared/types/controls";
import type { TranslateContext } from "../../../../../src/main/emulators/translatorTypes";

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
      expect(stickLUp.value).toBe("SDL-0/-LeftY"); // normal UP for Left stick is GP_LS_UP (negative sign for up in DuckStation)
    }
  });

  it("should translate keyboard bindings for win32 platform via DuckStationTranslator correctly", () => {
    const winContext: TranslateContext = {
      platform: "win32",
      configDir: "/mock/config/dir",
      consoleId: "ps1",
    };
    const translator = new DuckStationTranslator();
    const result = translator.translate(profile, winContext);
    expect(result.length).toBeGreaterThan(0);

    const buttonCross = result.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(buttonCross).toBeDefined();
    if (buttonCross && buttonCross.kind === "ini-set") {
      expect(buttonCross.value).toBe("Keyboard/U");
    }
  });

  it.skip("should derive dynamic SDL device index from learnedDevice, preferredControllerId, and padPort", () => {
    const gamepadProfile: ControlsProfile = {
      ...profile,
      preferredControllerId: "SDL-2",
      player1: {
        ...profile.player1,
        face: {
          type: "face",
          primary: { type: "gp_button", token: "GP_A" },
        }
      }
    };
    const translator = new DuckStationTranslator();

    // 1. ctx.learnedDevice takes priority
    const ctxLearned: TranslateContext = { ...context, learnedDevice: "SDL-3" };
    const resLearned = translator.translate(gamepadProfile, ctxLearned);
    const crossLearned = resLearned.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(crossLearned && crossLearned.kind === "ini-set" ? crossLearned.value : null).toBe("SDL-3/A");

    // 2. Fall back to profile.preferredControllerId ("SDL-2")
    const resPreferred = translator.translate(gamepadProfile, context);
    const crossPreferred = resPreferred.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(crossPreferred && crossPreferred.kind === "ini-set" ? crossPreferred.value : null).toBe("SDL-2/A");

    // 3. Fall back to ctx.padPort (padPort: 2 -> index 1)
    const noPreferredProfile: ControlsProfile = { ...gamepadProfile, preferredControllerId: undefined };
    const ctxPort: TranslateContext = { ...context, padPort: 2 };
    const resPort = translator.translate(noPreferredProfile, ctxPort);
    const crossPort = resPort.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(crossPort && crossPort.kind === "ini-set" ? crossPort.value : null).toBe("SDL-1/A");
  });
});

