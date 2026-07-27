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

  it("should handle stick-based special C bindings and translate to gamepad axis", () => {
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
    // Gamepad stick axis GP_RS_UP (index 23) -> "0x2/0/23;;"
    expect(result["R-Up"]).toBe("0x2/0/23;;");
  });

  it("should translate gamepad button and axis bindings for Ares correctly on darwin and win32", () => {
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
        },
        special: {
          type: "n64",
          z: { type: "gp_button", token: "GP_L2" },
        }
      }
    };
    const translator = new AresTranslator();

    // Test macOS (darwin)
    const resultMac = translator.translateFromPlayer(gamepadProfile.player1, "darwin");
    expect(resultMac["A..South"]).toBe("0x2/0/0;;"); // GP_A -> 0
    expect(resultMac["B..East"]).toBe("0x2/0/1;;");  // GP_B -> 1
    expect(resultMac["L-Up"]).toBe("0x2/0/19;;");   // GP_LS_UP -> 19
    expect(resultMac["L-Trigger"]).toBe("0x2/0/12;;"); // GP_L2 -> 12

    // Test Windows (win32)
    const resultWin = translator.translateFromPlayer(gamepadProfile.player1, "win32");
    expect(resultWin["A..South"]).toBe("0x2/0/0;;");
    expect(resultWin["B..East"]).toBe("0x2/0/1;;");
    expect(resultWin["L-Up"]).toBe("0x2/0/19;;");
    expect(resultWin["L-Trigger"]).toBe("0x2/0/12;;");

    // Test with custom device index (deviceIndex = 2)
    const resultIdx2 = translator.translateFromPlayer(gamepadProfile.player1, "darwin", 2);
    expect(resultIdx2["A..South"]).toBe("0x2/2/0;;");
    expect(resultIdx2["B..East"]).toBe("0x2/2/1;;");
    expect(resultIdx2["L-Trigger"]).toBe("0x2/2/12;;");
  });

  it("should translate bindings for win32 platform via AresTranslator correctly", () => {
    const translator = new AresTranslator();
    const resultWin = translator.translateFromPlayer(profile.player1, "win32");
    expect(resultWin).toBeDefined();

    // 'KeyT' for Start -> VK_T (84) -> "0x1/0/84;;"
    expect(resultWin["Start"]).toBe("0x1/0/84;;");

    // 'KeyU' for A -> VK_U (85) -> "0x1/0/85;;"
    expect(resultWin["A..South"]).toBe("0x1/0/85;;");

    // 'KeyW' for Analog Up -> VK_W (87) -> "0x1/0/87;;"
    expect(resultWin["L-Up"]).toBe("0x1/0/87;;");
  });
});

