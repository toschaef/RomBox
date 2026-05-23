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
    expect((buttonCross as any).value).toBe("Keyboard/U");

    // system.start is 'KeyT' -> 'Keyboard/T'
    const buttonStart = result.find(p => p.kind === "ini-set" && p.key === "Start");
    expect(buttonStart).toBeDefined();
    expect((buttonStart as any).value).toBe("Keyboard/T");

    // dpad.up is 'Digit3' -> 'Keyboard/3'
    const buttonUp = result.find(p => p.kind === "ini-set" && p.key === "Up");
    expect(buttonUp).toBeDefined();
    expect((buttonUp as any).value).toBe("Keyboard/3");

    // move.up is 'KeyW' -> 'Keyboard/W'
    const stickLUp = result.find(p => p.kind === "ini-set" && p.key === "LUp");
    expect(stickLUp).toBeDefined();
    expect((stickLUp as any).value).toBe("Keyboard/W");
  });
});
