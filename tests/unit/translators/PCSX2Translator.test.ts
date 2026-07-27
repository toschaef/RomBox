import { PCSX2Translator } from "../../../src/main/utils/translators/PCSX2Translator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

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

  it("should derive dynamic SDL device index from learnedDevice, preferredControllerId, and padPort for PCSX2", () => {
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

