import { AzaharTranslator } from "../../../src/main/utils/translators/AzaharTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

describe("AzaharTranslator", () => {
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
    consoleId: "nes",
  };

  it("should translate bindings via AzaharTranslator correctly", () => {
    const translator = new AzaharTranslator(null);
    const result = translator.translate({ bindings: profile.player1, ctx: context });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].kind).toBe("ini-set");

    // Assert that standard bindings map to correct Qt keycode structures
    // face.primary is 'KeyU' -> 'U' -> 85 -> "code:85,engine:keyboard"
    const buttonA = result.find(p => p.kind === "ini-set" && p.key === "profiles\\1\\button_a");
    expect(buttonA).toBeDefined();
    expect((buttonA as any).value).toBe('"code:85,engine:keyboard"');

    // system.start is 'KeyT' -> 'T' -> 84 -> "code:84,engine:keyboard"
    const buttonStart = result.find(p => p.kind === "ini-set" && p.key === "profiles\\1\\button_start");
    expect(buttonStart).toBeDefined();
    expect((buttonStart as any).value).toBe('"code:84,engine:keyboard"');

    // dpad.up is 'Digit3' -> '3' -> 51 -> "code:51,engine:keyboard"
    const buttonUp = result.find(p => p.kind === "ini-set" && p.key === "profiles\\1\\button_up");
    expect(buttonUp).toBeDefined();
    expect((buttonUp as any).value).toBe('"code:51,engine:keyboard"');
  });
});
