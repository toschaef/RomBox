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

  it("should translate gamepad bindings via MesenTranslator correctly", () => {
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
        }
      }
    };

    const translator = new MesenTranslator();

    // Test translation with gamepad device and move source
    const resultMove = translator.translateForDeviceFromPlayer(gamepadProfile.player1, 1, "gamepad", "move");
    expect(Object.keys(resultMove).length).toBeGreaterThan(0);

    // GP_A maps to 4096 (BASE_GAMEPAD + 0)
    expect(resultMove["A"]).toBe(4096);
    // GP_B maps to 4097 (BASE_GAMEPAD + 1)
    expect(resultMove["B"]).toBe(4097);

    // move.up maps to GP_LS_UP (index 19) -> 4096 + 19 = 4115
    expect(resultMove["Up"]).toBe(4115);
  });
});
