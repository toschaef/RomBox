import { MelonDSTranslator } from "../../../src/main/utils/translators/MelonDSTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

describe("MelonDSTranslator", () => {
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
    consoleId: "ds",
  };

  it("should translate bindings via MelonDSTranslator correctly", () => {
    const translator = new MelonDSTranslator();
    const result = translator.translateFromPlayer(profile.player1, context, 0);
    expect(result.length).toBeGreaterThan(0);

    // Verify key mappings
    // face.primary is 'KeyU' -> A is 'U' -> 85
    const keyA = result.find(p => p.kind === "ini-set" && p.section === "Instance0.Keyboard" && p.key === "A");
    expect(keyA).toBeDefined();
    expect((keyA as any).value).toBe("85");

    const keyKeyA = result.find(p => p.kind === "ini-set" && p.section === "" && p.key === "Key_A");
    expect(keyKeyA).toBeDefined();
    expect((keyKeyA as any).value).toBe("85");

    // system.start is 'KeyT' -> Start is 'T' -> 84
    const keyStart = result.find(p => p.kind === "ini-set" && p.section === "Instance0.Keyboard" && p.key === "Start");
    expect(keyStart).toBeDefined();
    expect((keyStart as any).value).toBe("84");

    // dpad.up is 'Digit3' -> Up is '3' -> 51
    const keyUp = result.find(p => p.kind === "ini-set" && p.section === "Instance0.Keyboard" && p.key === "Up");
    expect(keyUp).toBeDefined();
    expect((keyUp as any).value).toBe("51");
  });
});
