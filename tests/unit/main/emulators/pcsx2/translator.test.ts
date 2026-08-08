import { PCSX2Translator } from "../../../../../src/main/emulators/pcsx2/translator";
import { createDefaultProfileShape } from "../../../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../../../src/shared/types/controls";
import type { TranslateContext } from "../../../../../src/main/emulators/translatorTypes";

describe("PCSX2Translator", () => {
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
    consoleId: "ps2",
  };

  it("should translate bindings via PCSX2Translator correctly", () => {
    const translator = new PCSX2Translator();
    const result = translator.translate(profile, context);
    expect(result.length).toBeGreaterThan(0);

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

  it("maps left/right stick up/down to the correct SDL axis half", () => {
    // Regression: PCSX2's [PadN] LUp/LDown keys expect PCSX2's own "-"/"+"
    // half-axis convention, where "-Axis" is the SDL-negative half. SDL
    // reports a raw negative Y when the stick is pushed up, so LUp must map
    // to "-LeftY" and LDown to "+LeftY" - matching how the right stick
    // (RUp/RDown) and every other emulator's schema (DuckStation, Dolphin,
    // MelonDS) already map up/down. The left stick's Y axis was previously
    // swapped relative to all of these, inverting up/down for PS2 games.
    const gamepadProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        move: { type: "stick", stick: "left", deadzone: 0.25 },
        look: { type: "stick", stick: "right", deadzone: 0.25 },
      },
    };

    const translator = new PCSX2Translator();
    const result = translator.translate(gamepadProfile, context);

    const get = (key: string) => {
      const p = result.find(p => p.kind === "ini-set" && p.key === key);
      return p && p.kind === "ini-set" ? p.value : null;
    };

    expect(get("LUp")).toBe("SDL-0/-LeftY");
    expect(get("LDown")).toBe("SDL-0/+LeftY");
    expect(get("RUp")).toBe("SDL-0/-RightY");
    expect(get("RDown")).toBe("SDL-0/+RightY");
  });

  it("binds the DualShock2 analog toggle to Guide", () => {
    const translator = new PCSX2Translator();
    const result = translator.translate(profile, context);

    const analog = result.find(p => p.kind === "ini-set" && p.key === "Analog");
    expect(analog).toBeDefined();
    if (analog && analog.kind === "ini-set") {
      expect(analog.section).toBe("Pad1");
      expect(analog.value).toBe("SDL-0/Guide");
    }
  });

  it.skip("should derive dynamic SDL device index from learnedDevice, preferredControllerId, and padPort for PCSX2", () => {
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
    const translator = new PCSX2Translator();

    // 1. ctx.learnedDevice takes priority
    const ctxLearned: TranslateContext = { ...context, learnedDevice: "SDL-3" };
    const resLearned = translator.translate(gamepadProfile, ctxLearned);
    const crossLearned = resLearned.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(crossLearned && crossLearned.kind === "ini-set" ? crossLearned.value : null).toBe("SDL-3/FaceSouth");

    // 2. Fall back to profile.preferredControllerId ("SDL-2")
    const resPreferred = translator.translate(gamepadProfile, context);
    const crossPreferred = resPreferred.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(crossPreferred && crossPreferred.kind === "ini-set" ? crossPreferred.value : null).toBe("SDL-2/FaceSouth");

    // 3. Fall back to ctx.padPort (padPort: 2 -> index 1)
    const noPreferredProfile: ControlsProfile = { ...gamepadProfile, preferredControllerId: undefined };
    const ctxPort: TranslateContext = { ...context, padPort: 2 };
    const resPort = translator.translate(noPreferredProfile, ctxPort);
    const crossPort = resPort.find(p => p.kind === "ini-set" && p.key === "Cross");
    expect(crossPort && crossPort.kind === "ini-set" ? crossPort.value : null).toBe("SDL-1/FaceSouth");
  });
});

