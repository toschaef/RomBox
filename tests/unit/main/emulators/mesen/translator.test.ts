import { MesenTranslator } from "../../../../../src/main/emulators/mesen/translator";
import { createDefaultProfileShape } from "../../../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../../../src/shared/types/controls";

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

    // GP_A maps to 4096 (BASE_GAMEPAD + 0) on macOS
    expect(resultMove["A"]).toBe(4096);
    // GP_B maps to 4097 (BASE_GAMEPAD + 1) on macOS
    expect(resultMove["B"]).toBe(4097);

    // move.up maps to GP_LS_UP (macOS "Y+" index 18) -> 4096 + 18 = 4114
    expect(resultMove["Up"]).toBe(4114);
  });

  it("should translate gamepad bindings for win32 platform via MesenTranslator correctly", () => {
    const gamepadProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        face: {
          type: "face",
          primary: { type: "gp_button", token: "GP_A" },
          secondary: { type: "gp_button", token: "GP_B" },
        },
        system: {
          type: "system",
          start: { type: "gp_button", token: "GP_START" },
          select: { type: "gp_button", token: "GP_SELECT" },
        },
        dpad: {
          type: "dpad",
          up: { type: "gp_button", token: "GP_DPAD_UP" },
          down: { type: "gp_button", token: "GP_DPAD_DOWN" },
          left: { type: "gp_button", token: "GP_DPAD_LEFT" },
          right: { type: "gp_button", token: "GP_DPAD_RIGHT" },
        },
      }
    };

    const translator = new MesenTranslator();

    // Test with dpad source on Windows
    const result = translator.translateForDeviceFromPlayer(gamepadProfile.player1, 1, "gamepad", "dpad", "win32");

    // Windows XInput: GP_A = 13, GP_B = 14
    expect(result["A"]).toBe(4096 + 13);
    expect(result["B"]).toBe(4096 + 14);

    // Windows XInput: GP_START = 5, GP_SELECT/Back = 6
    expect(result["Start"]).toBe(4096 + 5);
    expect(result["Select"]).toBe(4096 + 6);

    // Windows XInput: GP_DPAD_UP = 1, GP_DPAD_DOWN = 2, GP_DPAD_LEFT = 3, GP_DPAD_RIGHT = 4
    expect(result["Up"]).toBe(4096 + 1);
    expect(result["Down"]).toBe(4096 + 2);
    expect(result["Left"]).toBe(4096 + 3);
    expect(result["Right"]).toBe(4096 + 4);
  });

  it("should translate keyboard bindings for win32 platform via MesenTranslator correctly", () => {
    const translator = new MesenTranslator();

    const resultMoveWin = translator.translateForDeviceFromPlayer(profile.player1, 1, "keyboard", "move", "win32");
    expect(Object.keys(resultMoveWin).length).toBeGreaterThan(0);

    // face.primary is 'KeyU' -> VK_U (85)
    expect(resultMoveWin["A"]).toBe(85);

    // system.start is 'KeyT' -> VK_T (84)
    expect(resultMoveWin["Start"]).toBe(84);

    // move.up is 'KeyW' -> VK_W (87)
    expect(resultMoveWin["Up"]).toBe(87);
  });

  it("should output declarative JSON merge patches purely without disk side effects", () => {
    const translator = new MesenTranslator();
    const patches = translator.translate(profile, { consoleId: "snes", platform: "darwin", configDir: "/non/existent/dir" });

    expect(patches).toHaveLength(1);
    const patch = patches[0];
    expect(patch.kind).toBe("json-set");
    if (patch.kind === "json-set") {
      expect(patch.path).toEqual(["Snes"]);
      expect(patch.value).toHaveProperty("Port1");
      const port1 = (patch.value as Record<string, unknown>).Port1 as Record<string, unknown>;
      expect(port1.Type).toBe("SnesController");
      expect(port1).toHaveProperty("Mapping1");
    }
  });
});



