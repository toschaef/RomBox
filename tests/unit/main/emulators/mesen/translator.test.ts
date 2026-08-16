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

  it("should translate a stick-based 'move' binding to XInput's left/right thumbstick digital codes on win32", () => {
    // Regression test: WindowsKeyManager.cpp's XInput button array reserves
    // indices 19-22 for the RIGHT thumbstick digital directions ("RT Up/Down/
    // Left/Right") and 23-26 for the LEFT thumbstick ("LT Up/Down/Left/Right")
    // - confirmed against XInputManager::IsPressed's sThumbLY/sThumbLX (23-26)
    // and sThumbRY/sThumbRX (19-22) cases. These were missing from
    // MESEN_WIN32_GAMEPAD_MAP entirely, so any profile using a physical stick
    // for movement (not the d-pad) silently produced keycode 0 on Windows -
    // i.e. gamepad direction input did nothing, even though buttons worked.
    const stickProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        move: { type: "stick", stick: "left", deadzone: 0.15 },
        look: { type: "stick", stick: "right", deadzone: 0.15 },
      }
    };

    const translator = new MesenTranslator();
    const moveResult = translator.translateForDeviceFromPlayer(stickProfile.player1, 1, "gamepad", "move", "win32");

    // left stick: GP_LS_UP=23, GP_LS_DOWN=24, GP_LS_LEFT=25, GP_LS_RIGHT=26
    expect(moveResult["Up"]).toBe(4096 + 23);
    expect(moveResult["Down"]).toBe(4096 + 24);
    expect(moveResult["Left"]).toBe(4096 + 25);
    expect(moveResult["Right"]).toBe(4096 + 26);

    const lookResult = translator.translateForDeviceFromPlayer(
      { ...stickProfile.player1, move: stickProfile.player1.look }, 1, "gamepad", "move", "win32"
    );
    // right stick: GP_RS_UP=19, GP_RS_DOWN=20, GP_RS_LEFT=21, GP_RS_RIGHT=22
    expect(lookResult["Up"]).toBe(4096 + 19);
    expect(lookResult["Down"]).toBe(4096 + 20);
    expect(lookResult["Left"]).toBe(4096 + 21);
    expect(lookResult["Right"]).toBe(4096 + 22);
  });

  it("should translate keyboard bindings for win32 platform via MesenTranslator correctly", () => {
    const translator = new MesenTranslator();

    const resultMoveWin = translator.translateForDeviceFromPlayer(profile.player1, 1, "keyboard", "move", "win32");
    expect(Object.keys(resultMoveWin).length).toBeGreaterThan(0);

    // face.primary is 'KeyU' -> Mesen's shared KeyDefinition ordinal for U (64)
    expect(resultMoveWin["A"]).toBe(64);

    // system.start is 'KeyT' -> shared ordinal for T (63)
    expect(resultMoveWin["Start"]).toBe(63);

    // move.up is 'KeyW' -> shared ordinal for W (66)
    expect(resultMoveWin["Up"]).toBe(66);
  });

  describe("DirectInput fallback for non-XInput controllers on win32", () => {
    const gamepadProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        face: {
          type: "face",
          primary: { type: "gp_button", token: "GP_A" },
          secondary: { type: "gp_button", token: "GP_B" },
        },
        shoulders: {
          type: "shoulders",
          triggerL: { type: "gp_button", token: "GP_L2" },
          triggerR: { type: "gp_button", token: "GP_R2" },
        },
        move: { type: "stick", stick: "left", deadzone: 0.15 },
        dpad: {
          type: "dpad",
          up: { type: "gp_button", token: "GP_DPAD_UP" },
          down: { type: "gp_button", token: "GP_DPAD_DOWN" },
          left: { type: "gp_button", token: "GP_DPAD_LEFT" },
          right: { type: "gp_button", token: "GP_DPAD_RIGHT" },
        },
      }
    };

    // The POV hat comes straight from DirectInputManager::IsPressed's fixed
    // DIJOYSTATE2 offsets (see emulators/Mesen2/Windows/DirectInputManager.cpp)
    // - identical for every device, so no probe data is required to bind it.
    // The left stick's fallback also happens to be X/Y (Mesen's case 0-3),
    // which is the near-universal HID convention for a device's primary
    // stick, but unlike the hat this is only a best-effort default (see the
    // "prefers probed axis data" tests below for why it isn't guaranteed).
    it("binds dpad to the fixed DirectInput hat offset when no stick is bound, and the left stick to its best-effort default, without any probe data", () => {
      const translator = new MesenTranslator();
      const deviceIndex = 0;

      // dpad-only profile: no "move" stick binding, so the hat offset is the
      // only candidate and wins regardless of the move/dpad priority.
      const dpadOnlyProfile: ControlsProfile = {
        ...profile,
        player1: { ...gamepadProfile.player1, move: { type: "dpad" } },
      };
      const dpadResult = translator.translateForDeviceFromPlayer(
        dpadOnlyProfile.player1, 1, "gamepad", "dpad", "win32", { deviceIndex }
      );
      // BaseDirectInputIndex(0x2000) + POV hat offsets: Up=12, Down=13, Right=14, Left=15
      expect(dpadResult["Up"]).toBe(0x2000 + 12);
      expect(dpadResult["Down"]).toBe(0x2000 + 13);
      expect(dpadResult["Right"]).toBe(0x2000 + 14);
      expect(dpadResult["Left"]).toBe(0x2000 + 15);

      const moveResult = translator.translateForDeviceFromPlayer(
        gamepadProfile.player1, 1, "gamepad", "move", "win32", { deviceIndex }
      );
      // left stick digital offsets: Up=0, Down=1, Left=2, Right=3
      expect(moveResult["Up"]).toBe(0x2000 + 0);
      expect(moveResult["Down"]).toBe(0x2000 + 1);
      expect(moveResult["Left"]).toBe(0x2000 + 2);
      expect(moveResult["Right"]).toBe(0x2000 + 3);
    });

    // Regression test: an earlier version of this table assumed the right
    // stick always lands on DIJOYSTATE2's Ry/Rx fields (Mesen case 4-7).
    // Verified empirically against a real DualSense that this is wrong - its
    // right stick reports on Z/Rz (case 8-11), and Ry/Rx (case 4-7) is
    // actually where its L2/R2 triggers report. Without probe data there's no
    // way to know for certain, so this is only the fallback guess.
    it("falls back to the Z/Rz-based default for the right stick without probe data", () => {
      const translator = new MesenTranslator();
      const rightStickProfile: ControlsProfile = {
        ...profile,
        player1: { ...profile.player1, move: { type: "stick", stick: "right", deadzone: 0.15 } },
      };

      const result = translator.translateForDeviceFromPlayer(
        rightStickProfile.player1, 1, "gamepad", "move", "win32", { deviceIndex: 0 }
      );
      expect(result["Left"]).toBe(0x2000 + 8);
      expect(result["Right"]).toBe(0x2000 + 9);
      expect(result["Up"]).toBe(0x2000 + 10);
      expect(result["Down"]).toBe(0x2000 + 11);
    });

    // Real values captured from a DualSense probed with forceDirectInputBackend.
    it("prefers probed axis data for the right stick over the fixed fallback", () => {
      const translator = new MesenTranslator();
      const rightStickProfile: ControlsProfile = {
        ...profile,
        player1: { ...profile.player1, move: { type: "stick", stick: "right", deadzone: 0.15 } },
      };

      const result = translator.translateForDeviceFromPlayer(
        rightStickProfile.player1, 1, "gamepad", "move", "win32",
        {
          deviceIndex: 0,
          learnedBinds: {
            GP_RS_LEFT: { kind: "axis", axis: 2, direction: "-", threshold: 0.5 },
            GP_RS_RIGHT: { kind: "axis", axis: 2, direction: "+", threshold: 0.5 },
            GP_RS_UP: { kind: "axis", axis: 5, direction: "-", threshold: 0.5 },
            GP_RS_DOWN: { kind: "axis", axis: 5, direction: "+", threshold: 0.5 },
          },
        }
      );
      // DI axis 2 = Z -> Mesen case 8/9; DI axis 5 = Rz -> Mesen case 10/11
      expect(result["Left"]).toBe(0x2000 + 8);
      expect(result["Right"]).toBe(0x2000 + 9);
      expect(result["Up"]).toBe(0x2000 + 10);
      expect(result["Down"]).toBe(0x2000 + 11);
    });

    it("falls back to the common PlayStation-pad button layout without a probed raw button index", () => {
      // The SDL probe helper isn't always installed/available (e.g. the native
      // binary is missing, or the probe otherwise fails) - unlike leaving these
      // buttons completely dead, a best-effort static layout (mirroring
      // MelonDSTranslator's own static TOKEN_TO_JOY_CODE fallback) keeps the
      // controller usable out of the box for the common case, matching Sony's
      // fairly standardized DS4/DualSense DirectInput HID button order.
      const translator = new MesenTranslator();
      const result = translator.translateForDeviceFromPlayer(
        gamepadProfile.player1, 1, "gamepad", "move", "win32", { deviceIndex: 0 }
      );
      // GP_A (bottom/Cross) -> raw index 1, GP_B (right/Circle) -> raw index 2,
      // GP_L2 -> raw index 6
      expect(result["A"]).toBe(0x2000 + 16 + 1);
      expect(result["B"]).toBe(0x2000 + 16 + 2);
      expect(result["L2"]).toBe(0x2000 + 16 + 6);
    });

    it("binds face/shoulder buttons to the probed raw HID button index once learned", () => {
      const translator = new MesenTranslator();
      const result = translator.translateForDeviceFromPlayer(
        gamepadProfile.player1, 1, "gamepad", "move", "win32",
        {
          deviceIndex: 0,
          learnedBinds: {
            GP_A: { kind: "button", button: 1 }, // Cross, 0-based raw index 1
            GP_B: { kind: "button", button: 2 }, // Circle
            GP_L2: { kind: "axis", axis: 4, direction: "+", threshold: 0.5 },
          },
        }
      );
      // raw button offset starts at 16: BaseDirectInputIndex + 16 + rawIndex
      expect(result["A"]).toBe(0x2000 + 16 + 1);
      expect(result["B"]).toBe(0x2000 + 16 + 2);
      // DI axis 4 (Ry, per DirectInputManager.cpp's declared X,Y,Z,Rx,Ry,Rz
      // order) remaps to Mesen's case pair 4/5 - NOT axis*2 (naive
      // declaration-order multiplication gives the wrong answer here, since
      // Mesen's own case numbering is Y,X,Ry,Rx,Z,Rz, not X,Y,Z,Rx,Ry,Rz).
      expect(result["L2"]).toBe(0x2000 + 5);
    });

    it("falls back to the stick binding for DirectInput direction when only 'move' is gamepad-bound", () => {
      // Regression test: Mapping3 (XInput) is permanently dead for a
      // controller Windows doesn't recognize as XInput, so Mapping4
      // (DirectInput) is that player's ONLY chance at directional input.
      // Mapping4 is planned with dirSource="dpad", but a player who bound
      // movement to their physical stick (not the d-pad buttons) has nothing
      // in "dpad" to translate - it must fall back to "move" instead of
      // leaving the direction completely unbound.
      const stickOnlyProfile: ControlsProfile = {
        ...profile,
        player1: {
          ...profile.player1,
          move: { type: "stick", stick: "left", deadzone: 0.15 },
          dpad: { type: "dpad" }, // no bindings - this player only uses the stick
        }
      };

      const translator = new MesenTranslator();
      const result = translator.translateForDeviceFromPlayer(
        stickOnlyProfile.player1, 1, "gamepad", "dpad", "win32", { deviceIndex: 0 }
      );

      expect(result["Up"]).toBe(0x2000 + 0);
      expect(result["Down"]).toBe(0x2000 + 1);
      expect(result["Left"]).toBe(0x2000 + 2);
      expect(result["Right"]).toBe(0x2000 + 3);
    });

    it("prefers the move-sourced binding over dpad when both are gamepad-bound", () => {
      // Regression test: Mapping4 is the only live directional slot for a
      // DirectInput-only controller (Mapping3/XInput never registers), so
      // when a profile binds both the physical D-pad and the stick (the
      // default gamepad preset always does), the stick must win - it's the
      // player's deliberately-chosen movement source. Preferring dpad here
      // silently dropped stick input; confirmed against a real DualSense
      // where Mesen's own capture of "push stick up" produced the left-stick
      // offset (0), not the hat offset (12) RomBox was emitting instead.
      const translator = new MesenTranslator();
      const result = translator.translateForDeviceFromPlayer(
        gamepadProfile.player1, 1, "gamepad", "dpad", "win32", { deviceIndex: 0 }
      );
      // gamepadProfile has both dpad (hat) and move (stick) bound - move wins
      expect(result["Up"]).toBe(0x2000 + 0);
    });

    it("still binds stick-only movement end-to-end through translate() for a DirectInput controller", () => {
      const stickOnlyProfile: ControlsProfile = {
        ...profile,
        player1: {
          ...profile.player1,
          face: { ...profile.player1.face, primary: { type: "gp_button", token: "GP_A" } },
          move: { type: "stick", stick: "left", deadzone: 0.15 },
          dpad: { type: "dpad" },
        }
      };

      const translator = new MesenTranslator();
      const patches = translator.translate(stickOnlyProfile, {
        consoleId: "snes",
        platform: "win32",
        configDir: "/tmp",
        deviceIndex: 0,
      });

      const patch = patches[0];
      if (patch.kind !== "json-set") throw new Error("expected json-set patch");
      const port1 = (patch.value as Record<string, unknown>).Port1 as Record<string, Record<string, number>>;

      // Mapping3 (XInput) is dead for a DirectInput-only device in practice,
      // but Mapping4 (DirectInput) must still carry the stick-sourced direction.
      expect(port1.Mapping4.Up).toBe(0x2000 + 0);
      expect(port1.Mapping4.Down).toBe(0x2000 + 1);
      expect(port1.Mapping4.Left).toBe(0x2000 + 2);
      expect(port1.Mapping4.Right).toBe(0x2000 + 3);
    });

    it("addresses a second physical device via deviceIndex", () => {
      const translator = new MesenTranslator();
      const result = translator.translateForDeviceFromPlayer(
        gamepadProfile.player1, 1, "gamepad", "dpad", "win32", { deviceIndex: 1 }
      );
      // gamepadProfile has both dpad and move bound - move wins, offset into device 1's block
      expect(result["Up"]).toBe(0x2000 + 0x100 + 0);
    });

    it("keeps Mapping3 on XInput codes and only repurposes Mapping4 to DirectInput on win32", () => {
      const translator = new MesenTranslator();
      const patches = translator.translate(gamepadProfile, {
        consoleId: "snes",
        platform: "win32",
        configDir: "/tmp",
        deviceIndex: 0,
        learnedBinds: { GP_A: { kind: "button", button: 1 } },
      });

      expect(patches).toHaveLength(1);
      const patch = patches[0];
      expect(patch.kind).toBe("json-set");
      if (patch.kind !== "json-set") throw new Error("expected json-set patch");

      const port1 = (patch.value as Record<string, unknown>).Port1 as Record<string, Record<string, number>>;
      // Mapping3 (move-sourced) stays XInput: GP_A -> BASE_GAMEPAD + 13
      expect(port1.Mapping3.A).toBe(0x1000 + 13);
      // Mapping4 (dpad-sourced) is now DirectInput: GP_A via the probed raw index
      expect(port1.Mapping4.A).toBe(0x2000 + 16 + 1);
      // Mapping4 directions still work even though A needed a probe - move wins over dpad
      expect(port1.Mapping4.Up).toBe(0x2000 + 0);
    });

    it("does not touch darwin/macOS gamepad encoding", () => {
      const translator = new MesenTranslator();
      const patches = translator.translate(gamepadProfile, {
        consoleId: "snes",
        platform: "darwin",
        configDir: "/tmp",
      });

      const patch = patches[0];
      if (patch.kind !== "json-set") throw new Error("expected json-set patch");
      const port1 = (patch.value as Record<string, unknown>).Port1 as Record<string, Record<string, number>>;
      // GP_A on macOS -> BASE_GAMEPAD + 0, same value in both mapping slots
      expect(port1.Mapping3.A).toBe(0x1000 + 0);
      expect(port1.Mapping4.A).toBe(0x1000 + 0);
    });

    it("zeroes out Mapping1/Mapping2 instead of omitting them, overwriting any stale scheme Mesen left there", () => {
      // Mesen auto-populates a brand-new controller's Mapping1/Mapping2 with
      // its own factory presets (e.g. Xbox buttons, arrow keys - see
      // InputConfig.cs's DefaultKeyMappingType). A profile with no keyboard
      // bindings at all (gamepadProfile has none) used to leave those two
      // slots out of RomBox's patch entirely, letting Mesen's leftover preset
      // keep responding to input (e.g. arrow keys silently also moving the
      // character) underneath the gamepad bindings RomBox did write.
      const allGamepadProfile: ControlsProfile = {
        ...profile,
        player1: {
          ...gamepadProfile.player1,
          system: {
            type: "system",
            start: { type: "gp_button", token: "GP_START" },
            select: { type: "gp_button", token: "GP_SELECT" },
          },
        },
      };

      const translator = new MesenTranslator();
      const patches = translator.translate(allGamepadProfile, {
        consoleId: "snes",
        platform: "win32",
        configDir: "/tmp",
        deviceIndex: 0,
      });

      const patch = patches[0];
      if (patch.kind !== "json-set") throw new Error("expected json-set patch");
      const port1 = (patch.value as Record<string, unknown>).Port1 as Record<string, Record<string, number>>;

      expect(port1.Mapping1).toBeDefined();
      expect(port1.Mapping2).toBeDefined();
      for (const key of ["Up", "Down", "Left", "Right", "A", "B", "X", "Y", "L", "R", "L2", "R2", "Start", "Select"]) {
        expect(port1.Mapping1[key]).toBe(0);
        expect(port1.Mapping2[key]).toBe(0);
      }
    });
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



