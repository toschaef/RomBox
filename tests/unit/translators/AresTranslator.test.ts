import { AresTranslator } from "../../../src/main/utils/translators/AresTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";

describe("AresTranslator", () => {
  const profile: ControlsProfile = {
    id: "test-profile-id",
    name: "Test Profile",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    ...createDefaultProfileShape()
  };

  it("should translate bindings via AresTranslator correctly", () => {
    const translator = new AresTranslator();
    const result = translator.translateFromPlayer(profile.player1);
    expect(result).toBeDefined();

    // Verify specific button mappings map to the correct Ares keyboard code strings:
    // "0x1/0/<AresQuartzIndex>;;"
    // 'Digit3' for Dpad Up -> 'Num3' -> Index 24 -> "0x1/0/24;;"
    expect(result["Pad.Up"]).toBe("0x1/0/24;;");
    
    // 'KeyT' for Start -> 'T' -> Index 59 -> "0x1/0/59;;"
    expect(result["Start"]).toBe("0x1/0/59;;");

    // 'KeyU' for A -> 'U' -> Index 60 -> "0x1/0/60;;"
    expect(result["A..South"]).toBe("0x1/0/60;;");

    // 'KeyW' for Analog Up -> 'W' -> Index 62 -> "0x1/0/62;;"
    expect(result["L-Up"]).toBe("0x1/0/62;;");
  });
});
