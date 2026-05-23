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
    expect((buttonA as any).value).toBe("U");

    // system.start is 'KeyT' -> 'T'
    const buttonStart = result.find(p => p.kind === "ini-set" && p.key === "Buttons/Start");
    expect(buttonStart).toBeDefined();
    expect((buttonStart as any).value).toBe("T");

    // dpad.up is 'Digit3' -> '3'
    const buttonUp = result.find(p => p.kind === "ini-set" && p.key === "D-Pad/Up");
    expect(buttonUp).toBeDefined();
    expect((buttonUp as any).value).toBe("3");

    // move.up is 'KeyW' -> 'W'
    const stickUp = result.find(p => p.kind === "ini-set" && p.key === "Main Stick/Up");
    expect(stickUp).toBeDefined();
    expect((stickUp as any).value).toBe("W");
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
    const buttonA = result.find(p => p.kind === "ini-set" && p.key === "Classic/Buttons/A");
    expect(buttonA).toBeDefined();
    expect((buttonA as any).value).toBe("U");

    // system.start is 'KeyT' -> 'T' -> maps to '+' on classic controller
    const buttonPlus = result.find(p => p.kind === "ini-set" && p.key === "Classic/Buttons/+");
    expect(buttonPlus).toBeDefined();
    expect((buttonPlus as any).value).toBe("T");
  });
});
