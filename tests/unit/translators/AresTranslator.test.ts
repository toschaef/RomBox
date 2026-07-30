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
    const result = translator.translateFromPlayer(profile.player1, "darwin");
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
    // KeyZ -> Index 65 -> "0x1/0/65;;" (Z maps to R-Trigger; N64 core reads Z from pad.r_trigger)
    expect(result["R-Trigger"]).toBe("0x1/0/65;;");
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
    // No deviceID (as if no controller was probed) - gamepad bindings should be
    // explicitly cleared (";;", Ares' unbound convention), never written with a
    // guessed/fallback device id (ares would show it as "(disconnected)"), and
    // never just left as whatever was previously on disk.
    const resultNoDevice = translator.translateFromPlayer(specialProfile.player1);
    expect(resultNoDevice["R-Up"]).toBe(";;");

    const result = translator.translateFromPlayer(specialProfile.player1, "darwin", "0xdeadbeef");
    // Right stick Up: groupID=0 (Axis), right stick base index 2 + vertical(1) = 3, up = "Lo"
    // qualifier (empirically confirmed scheme: negative axis excursion = Lo, positive = Hi).
    expect(result["R-Up"]).toBe("0xdeadbeef/0/3/Lo;;");
  });

  it("should prefer the SDL probe's real axis mapping for stick directions over the hardcoded layout", () => {
    // Some controllers/drivers don't put the right stick at raw axes 2/3 (e.g. analog triggers can
    // land there instead), so the probe's per-device GP_RS_* binds must win over encodeStickDirection's
    // guess when available - this is what makes N64 C-Buttons (right stick) reliable across hardware.
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
    const binds = {
      GP_RS_UP: { kind: "axis" as const, axis: 5, direction: "-" as const, threshold: 0.5 },
      GP_RS_DOWN: { kind: "axis" as const, axis: 5, direction: "+" as const, threshold: 0.5 },
      GP_RS_LEFT: { kind: "axis" as const, axis: 4, direction: "-" as const, threshold: 0.5 },
      GP_RS_RIGHT: { kind: "axis" as const, axis: 4, direction: "+" as const, threshold: 0.5 },
    };
    const result = translator.translateFromPlayer(specialProfile.player1, "darwin", "0xdeadbeef", binds);
    // Probed axis 5 (not the hardcoded index 3) with "-" direction -> "Lo".
    expect(result["R-Up"]).toBe("0xdeadbeef/0/5/Lo;;");
    expect(result["R-Left"]).toBe("0xdeadbeef/0/4/Lo;;");

    // No probe data for this token -> falls back to the hardcoded standard layout, unchanged.
    const resultNoBinds = translator.translateFromPlayer(specialProfile.player1, "darwin", "0xdeadbeef", {});
    expect(resultNoBinds["R-Up"]).toBe("0xdeadbeef/0/3/Lo;;");
  });

  it("should translate gamepad button and axis bindings for Ares using probed device id and binds", () => {
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
    const binds = {
      GP_A: { kind: "button" as const, button: 0 },
      GP_B: { kind: "button" as const, button: 1 },
      GP_L2: { kind: "axis" as const, axis: 4, direction: "+" as const, threshold: 0.5 },
    };

    // Platform shouldn't affect gamepad encoding at all (only keyboard encoding is platform-specific).
    for (const platform of ["darwin", "win32"] as const) {
      const result = translator.translateFromPlayer(gamepadProfile.player1, platform, "0xdeadbeef", binds);
      expect(result["A..South"]).toBe("0xdeadbeef/3/0;;");    // GP_A: button kind, raw index 0
      expect(result["X..West"]).toBe("0xdeadbeef/3/1;;");     // GP_B: button kind, raw index 1 (B maps to West for N64)
      expect(result["L-Up"]).toBe("0xdeadbeef/0/1/Lo;;");     // GP_LS_UP: left stick, vertical index 1, Lo
      expect(result["R-Trigger"]).toBe("0xdeadbeef/0/4/Hi;;"); // GP_L2: axis kind, "+" direction -> Hi (Z maps to R-Trigger)
    }

    // A different probed device id changes the prefix but not the button/axis layout.
    const resultOtherDevice = translator.translateFromPlayer(gamepadProfile.player1, "darwin", "0x54c0ce6", binds);
    expect(resultOtherDevice["A..South"]).toBe("0x54c0ce6/3/0;;");
    expect(resultOtherDevice["L-Up"]).toBe("0x54c0ce6/0/1/Lo;;");

    // No binds entry for a button -> cleared (";;"), not guessed.
    const resultNoBinds = translator.translateFromPlayer(gamepadProfile.player1, "darwin", "0xdeadbeef");
    expect(resultNoBinds["A..South"]).toBe(";;");
  });

  it("should route the probed gamepad to whichever player it's actually bound to, not always player1", () => {
    // Regression: translate() used to hardcode `i === 0` when deciding which
    // player slot gets the probed device/binds, so a keyboard-P1/gamepad-P2
    // setup ended up with P2's gamepad bindings silently dropped (falling back
    // to whatever was already on disk for VirtualPad2 - often a stale copy of
    // P1's keyboard bindings).
    const mixedProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        face: { type: "face", primary: { type: "key", code: "KeyU" }, secondary: { type: "key", code: "KeyI" } },
      },
      player2: {
        ...profile.player1,
        face: {
          type: "face",
          primary: { type: "gp_button", token: "GP_A" },
          secondary: { type: "gp_button", token: "GP_B" },
        },
        shoulders: {
          type: "shoulders",
          bumperL: { type: "gp_button", token: "GP_L1" },
        },
      },
    };

    const translator = new AresTranslator();
    const binds = {
      GP_A: { kind: "button" as const, button: 0 },
      GP_B: { kind: "button" as const, button: 1 },
      GP_L1: { kind: "button" as const, button: 9 },
    };

    const patches = translator.translate(mixedProfile, {
      platform: "darwin",
      configDir: "/tmp",
      gamepadPlayerIndex: 1,
      learnedDevice: "030057564c050000e60c000000016800",
      learnedBinds: binds,
    });

    const vp1 = patches.filter((p) => p.kind === "ini-set" && p.section === "VirtualPad1") as Extract<typeof patches[number], { kind: "ini-set" }>[];
    const vp2 = patches.filter((p) => p.kind === "ini-set" && p.section === "VirtualPad2") as Extract<typeof patches[number], { kind: "ini-set" }>[];

    // Player1 (keyboard) must not pick up the gamepad device at all.
    expect(vp1.find((p) => p.key === "A..South")?.value).toBe("0x1/0/60;;");
    expect(vp1.some((p) => p.value.startsWith("0x1054c0ce6"))).toBe(false);

    // Player2 (gamepad) gets the real probed device/button indices.
    expect(vp2.find((p) => p.key === "A..South")?.value).toBe("0x1054c0ce6/3/0;;");
    expect(vp2.find((p) => p.key === "L-Bumper")?.value).toBe("0x1054c0ce6/3/9;;");
  });

  it("should translate bindings for win32 platform via AresTranslator correctly", () => {
    const translator = new AresTranslator();
    const resultWin = translator.translateFromPlayer(profile.player1, "win32");
    expect(resultWin).toBeDefined();

    // 'KeyT' for Start -> Index 54 -> "0x1/0/54;;"
    expect(resultWin["Start"]).toBe("0x1/0/54;;");

    // 'KeyU' for A -> Index 55 -> "0x1/0/55;;"
    expect(resultWin["A..South"]).toBe("0x1/0/55;;");

    // 'KeyW' for Analog Up -> Index 57 -> "0x1/0/57;;"
    expect(resultWin["L-Up"]).toBe("0x1/0/57;;");
  });
});

