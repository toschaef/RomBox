import fs from "fs";
import os from "os";
import path from "path";
import { DolphinTranslator } from "../../../../../src/main/emulators/dolphin/translator";
import { createDefaultProfileShape } from "../../../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../../../src/shared/types/controls";
import type { TranslateContext } from "../../../../../src/main/emulators/translatorTypes";
import child_process from "child_process";

describe("DolphinTranslator", () => {
  const profile: ControlsProfile = {
    id: "test-profile-id",
    name: "Test Profile",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    ...createDefaultProfileShape()
  };

  beforeEach(() => {
    jest.spyOn(child_process, "spawnSync").mockReturnValue({ stdout: "" } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const context: TranslateContext = {
    platform: "darwin",
    configDir: "/mock/config/dir",
    consoleId: "gc",
  };

  it("should translate bindings via DolphinTranslator correctly", () => {
    const translator = new DolphinTranslator();
    const result = translator.translate(profile, context);
    expect(result.length).toBeGreaterThan(0);

    // Verify key mappings for GC
    // face.primary is 'KeyU' -> 'U'
    const buttonA = result.find(p => p.kind === "ini-set" && p.key === "Buttons/A");
    expect(buttonA).toBeDefined();
    if (buttonA && buttonA.kind === "ini-set") {
      expect(buttonA.value).toBe("U");
    }

    // system.start is 'KeyT' -> 'T'
    const buttonStart = result.find(p => p.kind === "ini-set" && p.key === "Buttons/Start");
    expect(buttonStart).toBeDefined();
    if (buttonStart && buttonStart.kind === "ini-set") {
      expect(buttonStart.value).toBe("T");
    }

    // dpad.up is 'Digit3' -> '3'
    const buttonUp = result.find(p => p.kind === "ini-set" && p.key === "D-Pad/Up");
    expect(buttonUp).toBeDefined();
    if (buttonUp && buttonUp.kind === "ini-set") {
      expect(buttonUp.value).toBe("3");
    }

    // move.up is 'KeyW' -> 'W'
    const stickUp = result.find(p => p.kind === "ini-set" && p.key === "Main Stick/Up");
    expect(stickUp).toBeDefined();
    if (stickUp && stickUp.kind === "ini-set") {
      expect(stickUp.value).toBe("W");
    }
  });

  it("should translate bindings via DolphinTranslator for Wii console correctly", () => {
    const wiiContext: TranslateContext = {
      platform: "darwin",
      configDir: "/mock/config/dir",
      consoleId: "wii",
      controllerIds: ["classic"],
    };
    const translator = new DolphinTranslator();
    const result = translator.translate(profile, wiiContext);

    // Verify key mappings for Wii Classic Controller extension
    // face.primary is 'KeyU' -> 'U'
    const buttonAWii = result.find(p => p.kind === "ini-set" && p.key === "Classic/Buttons/A");
    expect(buttonAWii).toBeDefined();
    if (buttonAWii && buttonAWii.kind === "ini-set") {
      expect(buttonAWii.value).toBe("U");
    }

    // system.start is 'KeyT' -> 'T' -> maps to '+' on classic controller
    const buttonPlus = result.find(p => p.kind === "ini-set" && p.key === "Classic/Buttons/+");
    expect(buttonPlus).toBeDefined();
    if (buttonPlus && buttonPlus.kind === "ini-set") {
      expect(buttonPlus.value).toBe("T");
    }
  });

  it("binds the Wii Remote's own buttons (not inert Classic/* keys) when no controller model is picked", () => {
    // Regression: an unset controller model defaulted to the Classic extension
    // here while the Controls page displayed "Wii Remote (Vertical)". Every
    // binding went to Classic/* keys, which an emulated Wii Remote with no
    // Classic extension attached never reads - so the controller did nothing
    // on Wii, and what did get configured looked like a Classic/GameCube pad
    // no matter what the UI showed.
    const wiiContext: TranslateContext = {
      platform: "darwin",
      configDir: "/mock/config/dir",
      consoleId: "wii",
      // controllerId deliberately unset - must resolve to the console's first
      // supported model, matching what the Controls page shows.
    };
    const translator = new DolphinTranslator();
    const result = translator.translate(profile, wiiContext);

    const get = (key: string) => {
      const p = result.find(x => x.kind === "ini-set" && x.section === "Wiimote1" && x.key === key);
      return p && p.kind === "ini-set" ? p.value : undefined;
    };

    expect(get("Extension")).toBe("None");
    expect(get("Buttons/A")).toBe("U");   // face.primary
    expect(get("Buttons/B")).toBe("I");   // face.secondary
    expect(get("Buttons/+")).toBe("T");   // system.start
    expect(get("D-Pad/Up")).toBe("3");    // dpad.up
    // Classic/* keys are meaningless without the extension attached.
    expect(result.find(p => p.kind === "ini-set" && p.key === "Classic/Buttons/A")).toBeUndefined();
  });

  it("binds the Nunchuk's analog stick and buttons in Wii Remote + Nunchuk mode", () => {
    const wiiContext: TranslateContext = {
      platform: "darwin",
      configDir: "/mock/config/dir",
      consoleId: "wii",
      controllerIds: ["wiimote_nunchuk"],
    };
    // ControlsService seeds the console-specific `special` group before the
    // translator ever sees a layout; a raw profile has none, so supply it here.
    const nunchukProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        special: {
          type: "wii",
          nunchuckC: { type: "key", code: "Equal" },
          nunchuckZ: { type: "key", code: "Minus" },
        },
      },
    };

    const translator = new DolphinTranslator();
    const result = translator.translate(nunchukProfile, wiiContext);

    const get = (key: string) => {
      const p = result.find(x => x.kind === "ini-set" && x.section === "Wiimote1" && x.key === key);
      return p && p.kind === "ini-set" ? p.value : undefined;
    };

    expect(get("Extension")).toBe("Nunchuk");
    // Movement lives on the Nunchuk's stick in this mode - previously unbound
    // entirely, so Nunchuk players couldn't move.
    expect(get("Nunchuk/Stick/Up")).toBe("W");
    expect(get("Nunchuk/Stick/Left")).toBe("A");
    // "Equal"/"Minus" are the real DOM codes; the old "Key="/"Key-" fell
    // through the keycode mapper unmapped.
    expect(get("Nunchuk/Buttons/C")).toBe("=");
    expect(get("Nunchuk/Buttons/Z")).toBe("-");
  });

  it("Mario Kart Wii scenario: P1 on Classic Controller, P2 on Wii Remote + Nunchuk get independent Wiimote extensions", () => {
    const wiiContext: TranslateContext = {
      platform: "darwin",
      configDir: "/mock/config/dir",
      consoleId: "wii",
      controllerIds: ["classic", "wiimote_nunchuk"],
    };
    const twoPlayerProfile: ControlsProfile = {
      ...profile,
      player2: { ...profile.player1 },
    };

    const translator = new DolphinTranslator();
    const result = translator.translate(twoPlayerProfile, wiiContext);

    const p1Extension = result.find(p => p.kind === "ini-set" && p.section === "Wiimote1" && p.key === "Extension");
    const p2Extension = result.find(p => p.kind === "ini-set" && p.section === "Wiimote2" && p.key === "Extension");

    expect(p1Extension && p1Extension.kind === "ini-set" ? p1Extension.value : null).toBe("Classic");
    expect(p2Extension && p2Extension.kind === "ini-set" ? p2Extension.value : null).toBe("Nunchuk");

    // Regression: before per-player controllerId, every Wiimote1-4 section
    // shared the single console-wide controllerId, so P2 would have also come
    // out "Classic" instead of "Nunchuk".
    expect(p2Extension).not.toEqual(p1Extension);
  });

  it("does not write IR/Tilt/Shake/Wiimote-button bindings for a Classic Controller player, even if stale data exists", () => {
    // Simulates a player whose special.ir/tilt got populated at some point
    // (e.g. from having briefly used Wii Remote mode, or from the previously
    // exposed IR Pointer control under Classic Controller) but who is
    // currently configured as Classic Controller. These must not reach
    // WiimoteNew.ini: a real Classic Controller has no IR camera or
    // accelerometer, and leaving them in means whatever stick drives IR also
    // fights with that same stick's legitimate Classic Right Stick input.
    const wiiContext: TranslateContext = {
      platform: "darwin",
      configDir: "/mock/config/dir",
      consoleId: "wii",
      controllerIds: ["classic"],
    };
    const staleIrProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        special: {
          type: "wii",
          ir: { type: "stick", stick: "right", deadzone: 0.15 },
          tilt: { type: "stick", stick: "right", deadzone: 0.15 },
          shake: { type: "gp_button", token: "GP_A" },
          wiimoteA: { type: "gp_button", token: "GP_B" },
          home: { type: "gp_button", token: "GP_START" },
        },
      },
    };

    const translator = new DolphinTranslator();
    const result = translator.translate(staleIrProfile, wiiContext);

    const wiimoteSetByKey = new Map(
      result
        .filter(p => p.kind === "ini-set" && p.section === "Wiimote1")
        .map(p => [p.kind === "ini-set" ? p.key : "", p.kind === "ini-set" ? p.value : ""])
    );

    // Not writing a *new* value isn't enough on its own: ini-set only patches
    // keys it's told about, so a value from a previous config (or an earlier
    // RomBox version) would otherwise sit in WiimoteNew.ini forever. Classic
    // Controller must actively clear these keys with an explicit empty
    // assignment - Dolphin's own convention for "unbound" - rather than
    // leaving them untouched or simply omitting the key (a key that's just
    // absent isn't guaranteed to be treated as unbound, e.g. DualSense/
    // DualShock controllers expose a built-in gyro Dolphin can fall back to).
    for (const key of ["IR/Up", "IR/Down", "IR/Left", "IR/Right", "Tilt/Forward", "Tilt/Backward", "Shake/X", "Buttons/A"]) {
      expect(wiimoteSetByKey.get(key)).toBe("");
    }

    // special.home is a real Classic Controller button (Classic/Buttons/Home)
    // and should still come through on the Classic section.
    const classicHome = result.find(p => p.kind === "ini-set" && p.section === "Wiimote1" && p.key === "Classic/Buttons/Home");
    expect(classicHome).toBeDefined();
  });

  it("should translate bindings via DolphinTranslator using win32 DirectInput key strings when platform is win32", () => {
    const winContext: TranslateContext = {
      platform: "win32",
      configDir: "/mock/config/dir",
      consoleId: "gc",
    };
    const translator = new DolphinTranslator();
    const result = translator.translate(profile, winContext);

    // dpad.up is 'Digit3' -> '3' on win32
    const dpadUp = result.find(p => p.kind === "ini-set" && p.key === "D-Pad/Up");
    expect(dpadUp).toBeDefined();
    if (dpadUp && dpadUp.kind === "ini-set") {
      expect(dpadUp.value).toBe("3");
    }

    // move.up is 'KeyW' -> 'W'
    const stickUp = result.find(p => p.kind === "ini-set" && p.key === "Main Stick/Up");
    expect(stickUp).toBeDefined();
    if (stickUp && stickUp.kind === "ini-set") {
      expect(stickUp.value).toBe("W");
    }

    // Device string for keyboard on win32
    const device = result.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(device).toBeDefined();
    if (device && device.kind === "ini-set") {
      expect(device.value).toBe("DInput/0/Keyboard Mouse");
    }
  });

  it("resolves the win32 gamepad Device via the SDL probe instead of hardcoding XInput", () => {
    // Dolphin identifies controllers through its SDL backend on Windows too -
    // even non-Xbox pads like a PS5 DualSense show up as "SDL/<port>/<name>",
    // not as an XInput device. Blindly assuming XInput meant anything that
    // wasn't a genuine Xbox-style controller silently failed to register.
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(child_process, "spawnSync").mockReturnValue({
      stdout: JSON.stringify({ ok: true, guid: "abc123", name: "DualSense Wireless Controller", port: 0, binds: {} }),
    } as never);

    const winContext: TranslateContext = {
      platform: "win32",
      configDir: "/mock/config/dir",
      consoleId: "gc",
    };
    const gamepadProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
      },
    };

    const translator = new DolphinTranslator();
    const result = translator.translate(gamepadProfile, winContext);

    const device = result.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(device && device.kind === "ini-set" ? device.value : null).toBe("SDL/0/DualSense Wireless Controller");
  });

  it("falls back to XInput/<index>/Gamepad on win32 when the SDL probe finds nothing", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);
    jest.spyOn(child_process, "spawnSync").mockReturnValue({ stdout: "" } as never);

    const winContext: TranslateContext = {
      platform: "win32",
      configDir: "/mock/config/dir",
      consoleId: "gc",
    };
    const gamepadProfile: ControlsProfile = {
      ...profile,
      player1: {
        ...profile.player1,
        face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
      },
    };

    const translator = new DolphinTranslator();
    const result = translator.translate(gamepadProfile, winContext);

    const device = result.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(device && device.kind === "ini-set" ? device.value : null).toBe("XInput/0/Gamepad");
  });

  it("should translate gamepad bindings and GC Z-button correctly", () => {
    const gamepadProfile: ControlsProfile = {
      ...profile,
      preferredControllerId: "SDL/0/Controller",
      player1: {
        ...profile.player1,
        face: {
          type: "face",
          primary: { type: "gp_button", token: "GP_A" },
          secondary: { type: "gp_button", token: "GP_B" },
          tertiary: { type: "gp_button", token: "GP_X" },
          quaternary: { type: "gp_button", token: "GP_Y" },
        },
        system: {
          type: "system",
          start: { type: "gp_button", token: "GP_START" },
        },
        special: {
          type: "gc",
          z: { type: "gp_button", token: "GP_SELECT" },
        }
      }
    };

    const translator = new DolphinTranslator();
    const result = translator.translate(gamepadProfile, context);
    expect(result.length).toBeGreaterThan(0);

    // Verify Device matches the preferredControllerId
    const devicePatch = result.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(devicePatch).toBeDefined();
    if (devicePatch && devicePatch.kind === "ini-set") {
      expect(devicePatch.value).toBe("SDL/0/Controller");
    }

    // Buttons/A should be mapped to `Button A`
    const buttonA = result.find(p => p.kind === "ini-set" && p.key === "Buttons/A");
    expect(buttonA).toBeDefined();
    if (buttonA && buttonA.kind === "ini-set") {
      expect(buttonA.value).toBe("`Button S`");
    }

    // Buttons/Z should be mapped to `Back` (token GP_SELECT)
    const buttonZ = result.find(p => p.kind === "ini-set" && p.key === "Buttons/Z");
    expect(buttonZ).toBeDefined();
    if (buttonZ && buttonZ.kind === "ini-set") {
      expect(buttonZ.value).toBe("`Back`");
    }
  });

  it("should handle Wii special home bindings and detect device correctly", () => {
    const wiiContext: TranslateContext = {
      platform: "darwin",
      configDir: "/mock/config/dir",
      consoleId: "wii",
    };
    const wiiProfile: ControlsProfile = {
      ...profile,
      preferredControllerId: "SDL/0/Controller",
      player1: {
        ...profile.player1,
        special: {
          type: "wii",
          home: { type: "gp_button", token: "GP_START" },
        }
      }
    };
    const translator = new DolphinTranslator();
    const result = translator.translate(wiiProfile, wiiContext);
    expect(result.length).toBeGreaterThan(0);

    // Verify Device matches the preferredControllerId because home is a gamepad button
    const devicePatch = result.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(devicePatch).toBeDefined();
    if (devicePatch && devicePatch.kind === "ini-set") {
      expect(devicePatch.value).toBe("SDL/0/Controller");
    }
  });

  it("still configures every other player when one player's bindings are incomplete", () => {
    // Regression: `profile[playerKey]?.face.primary` stops its optional chain at
    // the player, not the group, so a player carrying only a partial binding set
    // threw a TypeError out of translate(). LaunchService swallows configure()
    // errors as a warning, so the game still launched - with GCPadNew.ini and
    // WiimoteNew.ini never written at all, leaving every player's controller dead.
    const partialPlayer2: ControlsProfile = {
      ...profile,
      player2: { special: { type: "wii", wiimoteA: { type: "key", code: "KeyM" } } } as never,
    };

    const translator = new DolphinTranslator();
    const wiiCtx: TranslateContext = { platform: "darwin", configDir: "/mock/config/dir", consoleId: "wii" };

    expect(() => translator.translate(partialPlayer2, wiiCtx)).not.toThrow();

    const result = translator.translate(partialPlayer2, wiiCtx);
    // Player 1 is fully configured despite player 2 being incomplete.
    expect(result.some(p => p.kind === "ini-set" && p.section === "Wiimote1" && p.key === "Buttons/A")).toBe(true);
    // And player 2 still gets what it does have.
    const p2a = result.find(p => p.kind === "ini-set" && p.section === "Wiimote2" && p.key === "Buttons/A");
    expect(p2a && p2a.kind === "ini-set" ? p2a.value : null).toBe("M");
  });

  describe("multiplayer device assignment (regression coverage for the P1/P2 collision bug)", () => {
    it("resolves each player's gamepad Device from the SDL3 probe's own --index, not a shared first-found controller", () => {
      // Simulates two distinct physical controllers connected on a Mac. The real
      // sdl3probe-macos binary now takes a --index arg and reports the Nth connected
      // gamepad; this stubs that same contract so player1 and player2 resolve to
      // different physical devices instead of both re-discovering "the" first one.
      jest.spyOn(child_process, "spawnSync").mockImplementation((_cmd, args) => {
        const argv = (args as string[]) ?? [];
        const idx = argv.includes("--index") ? argv[argv.indexOf("--index") + 1] : "0";
        return {
          stdout: JSON.stringify({ ok: true, guid: `guid-${idx}`, name: `Pad ${idx}`, port: Number(idx), binds: {} }),
        } as never;
      });

      const twoPlayerGamepadProfile: ControlsProfile = {
        ...profile,
        player1: {
          ...profile.player1,
          face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
        },
        player2: {
          ...profile.player1,
          face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
        },
      };

      const translator = new DolphinTranslator();
      const result = translator.translate(twoPlayerGamepadProfile, context);

      const p1Device = result.find(p => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      const p2Device = result.find(p => p.kind === "ini-set" && p.section === "GCPad2" && p.key === "Device");

      expect(p1Device && p1Device.kind === "ini-set" ? p1Device.value : null).toBe("SDL/0/Pad 0");
      expect(p2Device && p2Device.kind === "ini-set" ? p2Device.value : null).toBe("SDL/1/Pad 1");
    });

    it("only applies profile.preferredControllerId to player 1, not to player 2+", () => {
      // preferredControllerId is a single, profile-wide field - there's no per-player
      // controller picker. Applying it uniformly would point every player's GCPad
      // section at the exact same physical device the user picked for player 1.
      jest.spyOn(child_process, "spawnSync").mockReturnValue({
        stdout: JSON.stringify({ ok: true, guid: "auto-guid", name: "Auto Pad", port: 1, binds: {} }),
      } as never);

      const profileWithPreferred: ControlsProfile = {
        ...profile,
        preferredControllerId: "SDL/0/Chosen Controller",
        player1: {
          ...profile.player1,
          face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
        },
        player2: {
          ...profile.player1,
          face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
        },
      };

      const translator = new DolphinTranslator();
      const result = translator.translate(profileWithPreferred, context);

      const p1Device = result.find(p => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      const p2Device = result.find(p => p.kind === "ini-set" && p.section === "GCPad2" && p.key === "Device");

      expect(p1Device && p1Device.kind === "ini-set" ? p1Device.value : null).toBe("SDL/0/Chosen Controller");
      // Player 2 must NOT inherit player 1's explicitly chosen controller.
      expect(p2Device && p2Device.kind === "ini-set" ? p2Device.value : null).not.toBe("SDL/0/Chosen Controller");
      expect(p2Device && p2Device.kind === "ini-set" ? p2Device.value : null).toBe("SDL/1/Auto Pad");
    });

    it("never leaks a stale on-disk Device= into a fresh launch - each player always resolves live, ignoring the file", () => {
      // Device resolution never reads back its own previous output. A user
      // iterating on their bindings relaunches the game repeatedly while
      // changing controls (or swapping physical controllers); if RomBox ever
      // preferred whatever was last written to GCPadNew.ini over a fresh
      // probe, some of those relaunches would silently keep using stale state
      // instead of whatever's actually true right now. Both players' Devices
      // must come from the live probe fallback, matching what the probe
      // itself reports (mocked to fail here, so the generic index-based
      // guess), never the deliberately wrong values seeded on disk below.
      jest.spyOn(child_process, "spawnSync").mockReturnValue({ stdout: "" } as never);

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dolphin-no-cache-test-"));
      fs.writeFileSync(
        path.join(tmpDir, "GCPadNew.ini"),
        "[GCPad1]\nDevice = WGUS/0/Stale Controller One\n\n[GCPad2]\nDevice = WGUS/1/Stale Controller Two\n"
      );

      const twoPlayerGamepadProfile: ControlsProfile = {
        ...profile,
        player1: {
          ...profile.player1,
          face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
        },
        player2: {
          ...profile.player1,
          face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
        },
      };

      const translator = new DolphinTranslator();
      const result = translator.translate(twoPlayerGamepadProfile, { ...context, configDir: tmpDir });

      const p1Device = result.find(p => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      const p2Device = result.find(p => p.kind === "ini-set" && p.section === "GCPad2" && p.key === "Device");

      expect(p1Device && p1Device.kind === "ini-set" ? p1Device.value : null).toBe("SDL/0/Gamepad");
      expect(p2Device && p2Device.kind === "ini-set" ? p2Device.value : null).toBe("SDL/1/Gamepad");

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("prefers a successful live probe over a stale Device= already on disk", () => {
      jest.spyOn(child_process, "spawnSync").mockReturnValue({
        stdout: JSON.stringify({ ok: true, guid: "real-guid", name: "Real Pad", port: 0, binds: {} }),
      } as never);

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dolphin-cache-precedence-test-"));
      fs.writeFileSync(
        path.join(tmpDir, "GCPadNew.ini"),
        "[GCPad1]\nDevice = XInput/0/Gamepad\n" // stale/wrong value from a prior bad launch
      );

      const gamepadProfile: ControlsProfile = {
        ...profile,
        player1: {
          ...profile.player1,
          face: { type: "face", primary: { type: "gp_button", token: "GP_A" } },
        },
      };

      const translator = new DolphinTranslator();
      const result = translator.translate(gamepadProfile, { ...context, configDir: tmpDir });

      const p1Device = result.find(p => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      expect(p1Device && p1Device.kind === "ini-set" ? p1Device.value : null).toBe("SDL/0/Real Pad");

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  it.skip("should fall back to standard platform gamepad device strings when detectDolphinPadDevice returns null", () => {
    const gamepadProfileNoPref: ControlsProfile = {
      ...profile,
      preferredControllerId: undefined,
      player1: {
        ...profile.player1,
        face: {
          type: "face",
          primary: { type: "gp_button", token: "GP_A" },
        }
      }
    };
    const translator = new DolphinTranslator();

    // macOS platform fallback: SDL/0/Gamepad
    const resDarwin = translator.translate(gamepadProfileNoPref, { platform: "darwin", configDir: "/non/existent/dir", consoleId: "gc" });
    const deviceDarwin = resDarwin.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(deviceDarwin && deviceDarwin.kind === "ini-set" ? deviceDarwin.value : null).toBe("SDL/0/Gamepad");

    // win32 platform fallback: XInput/0/Gamepad
    const resWin = translator.translate(gamepadProfileNoPref, { platform: "win32", configDir: "/non/existent/dir", consoleId: "gc" });
    const deviceWin = resWin.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(deviceWin && deviceWin.kind === "ini-set" ? deviceWin.value : null).toBe("XInput/0/Gamepad");

    // learnedDevice fallback: SDL/2/Gamepad
    const resLearned = translator.translate(gamepadProfileNoPref, { platform: "darwin", configDir: "/non/existent/dir", consoleId: "gc", learnedDevice: "SDL/2/Gamepad" });
    const deviceLearned = resLearned.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(deviceLearned && deviceLearned.kind === "ini-set" ? deviceLearned.value : null).toBe("SDL/2/Gamepad");

    // deviceIndex / padPort fallback (padPort: 3 -> index 2): SDL/2/Gamepad
    const resPort = translator.translate(gamepadProfileNoPref, { platform: "darwin", configDir: "/non/existent/dir", consoleId: "gc", padPort: 3 });
    const devicePort = resPort.find(p => p.kind === "ini-set" && p.key === "Device");
    expect(devicePort && devicePort.kind === "ini-set" ? devicePort.value : null).toBe("SDL/2/Gamepad");
  });
});

