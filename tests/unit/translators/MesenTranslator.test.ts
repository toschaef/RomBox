import { MesenTranslator } from "../../../src/main/utils/translators/MesenTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";

describe("MesenTranslator", () => {
  const profile: ControlsProfile = {
    id: "test-profile-id",
    name: "Test Profile",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    ...createDefaultProfileShape()
  };

  it("should translate bindings via MesenTranslator correctly", () => {
    const translator = new MesenTranslator();
    
    // Test with "move" as the dirSource
    const resultMove = translator.translateForDeviceFromPlayer(profile.player1, 1, "keyboard", "move");
    expect(Object.keys(resultMove).length).toBeGreaterThan(0);

    // face.primary is 'KeyU' -> 64
    expect(resultMove["A"]).toBe(64);

    // system.start is 'KeyT' -> 63
    expect(resultMove["Start"]).toBe(63);

    // move.up is 'KeyW' -> 66
    expect(resultMove["Up"]).toBe(66);

    // Test with "dpad" as the dirSource
    const resultDpad = translator.translateForDeviceFromPlayer(profile.player1, 1, "keyboard", "dpad");
    // dpad.up is 'Digit3' -> 37
    expect(resultDpad["Up"]).toBe(37);
  });
});
