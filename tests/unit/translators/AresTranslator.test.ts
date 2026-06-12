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

    // 'ArrowUp' for look Up -> 'Up' -> Index 92 -> "0x1/0/92;;" (maps to R-Up as fallback)
    expect(result["R-Up"]).toBe("0x1/0/92;;");
  });

  it("should translate N64 special bindings correctly", () => {
    const specialProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        special: {
          type: "n64",
          z: { type: "key", code: "KeyZ" },
          c: {
            type: "dpad",
            up: { type: "key", code: "KeyI" },
            down: { type: "key", code: "KeyK" },
            left: { type: "key", code: "KeyJ" },
            right: { type: "key", code: "KeyL" },
          }
        }
      }
    };
    const translator = new AresTranslator();
    const result = translator.translateFromPlayer(specialProfile.player1);
    // KeyZ -> Index 65 -> "0x1/0/65;;" (maps to L-Trigger in Ares schema)
    expect(result["L-Trigger"]).toBe("0x1/0/65;;");
    // KeyI -> Index 48 -> "0x1/0/48;;" (C Up, maps to R-Up)
    expect(result["R-Up"]).toBe("0x1/0/48;;");
  });

  it("should handle stick-based special C bindings gracefully", () => {
    const specialProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        special: {
          type: "n64",
          c: {
            type: "stick",
            stick: "right",
            deadzone: 0.15,
          }
        }
      }
    };
    const translator = new AresTranslator();
    const result = translator.translateFromPlayer(specialProfile.player1);
    // Gamepad stick axes are not key-based, so they should return undefined in Ares (no crash)
    expect(result["R-Up"]).toBeUndefined();
  });
});
