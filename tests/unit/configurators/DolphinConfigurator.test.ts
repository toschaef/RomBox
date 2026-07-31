jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../../temp-userdata"),
  };
});

import path from "path";
import fs from "fs";
import child_process from "child_process";
import { initDB } from "../../../src/main/data/db";
import { DolphinConfigurator } from "../../../src/main/utils/configurators/DolphinConfigurator";
import { ControlsService } from "../../../src/main/services/ControlsService";
import { osHandler } from "../../../src/main/platform";
import type { Game } from "../../../src/shared/types";

// Returns just the body of one INI section. Assertions below go through this
// rather than matching raw file text, because the exact *section* a key lives
// in is load-bearing for Dolphin: SIDeviceN is only read from [Core] (not
// [Controls]), and wiimote Source is only read from WiimoteNew.ini's
// [WiimoteN]. A bare toContain() would happily pass on a key written into the
// wrong section - which is precisely the bug this guards against.
function iniSection(text: string, section: string): string {
  const m = text.match(new RegExp(`\\[${section}\\][\\s\\S]*?(?=\\n\\[|$)`));
  return m ? m[0] : "";
}

describe("DolphinConfigurator", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    jest.spyOn(osHandler, "getEmulatorConfigPath").mockReturnValue(
      path.join(tempDir, "Library", "Application Support", "Dolphin", "Config")
    );
    initDB();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should configure DolphinConfigurator for GC", async () => {
    const game: Game = {
      id: "wind-waker",
      title: "The Legend of Zelda: The Wind Waker",
      filePath: "/roms/ww.iso",
      consoleId: "gc",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("dolphin");

    const dolphinIni = path.join(configDir, "Dolphin.ini");
    expect(fs.existsSync(dolphinIni)).toBe(true);
    const dolphinText = fs.readFileSync(dolphinIni, "utf-8");
    expect(dolphinText).toContain("RenderToMain = False");
    expect(dolphinText).toContain("Fullscreen = False");

    const gfxIni = path.join(configDir, "GFX.ini");
    expect(fs.existsSync(gfxIni)).toBe(true);
    const gfxText = fs.readFileSync(gfxIni, "utf-8");
    expect(gfxText).toContain("InternalResolution = 1");

    const gcPadNew = path.join(configDir, "GCPadNew.ini");
    expect(fs.existsSync(gcPadNew)).toBe(true);
    const gcPadText = fs.readFileSync(gcPadNew, "utf-8");
    // GCPad1 face.primary 'KeyU' -> 'U'
    expect(gcPadText).toContain("Buttons/A = U");
    // GCPad1 system.start 'KeyT' -> 'T'
    expect(gcPadText).toContain("Buttons/Start = T");
  });

  it("should configure DolphinConfigurator for Wii", async () => {
    const game: Game = {
      id: "mario-galaxy",
      title: "Super Mario Galaxy",
      filePath: "/roms/smg.iso",
      consoleId: "wii",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("dolphin");

    const dolphinIni = path.join(configDir, "Dolphin.ini");
    expect(fs.existsSync(dolphinIni)).toBe(true);

    const wiimoteNew = path.join(configDir, "WiimoteNew.ini");
    expect(fs.existsSync(wiimoteNew)).toBe(true);
    const wiiText = fs.readFileSync(wiimoteNew, "utf-8");
    const wm1 = iniSection(wiiText, "Wiimote1");
    // Wiimote enablement is [Wiimote1] Source in WiimoteNew.ini (1 = Emulated),
    // NOT Dolphin.ini's [Controls] WiimoteSource0, which Dolphin never reads.
    expect(wm1).toContain("Source = 1");
    // With no controller model picked, the default is the console's first
    // supported model - a plain Wii Remote, matching the Controls page - and
    // its own buttons are what get bound.
    expect(wm1).toContain("Extension = None");
    expect(wm1).toContain("Buttons/A = U");
    expect(wm1).toContain("Buttons/+ = T");
  });

  it("binds Z to a key that doesn't collide with the R trigger on GameCube", async () => {
    // Regression: GameCube's default special.z was Digit0 - the same key the
    // default profile already uses for shoulders.triggerR - so pressing "0"
    // fired Z and R-Analog together and Z appeared mis-bound.
    const game: Game = {
      id: "melee-z",
      title: "Super Smash Bros. Melee",
      filePath: "/roms/melee.iso",
      consoleId: "gc",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
    };
    await new DolphinConfigurator(game).configure();

    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    const pad1 = iniSection(fs.readFileSync(path.join(configDir, "GCPadNew.ini"), "utf-8"), "GCPad1");

    const valueOf = (key: string) => pad1.match(new RegExp(`^${key.replace("/", "\\/")} = (.*)$`, "m"))?.[1];
    const z = valueOf("Buttons/Z");

    expect(z).toBeDefined();
    expect(z).not.toBe(valueOf("Triggers/R-Analog"));
    expect(z).not.toBe(valueOf("Triggers/L-Analog"));
    expect(z).not.toBe(valueOf("Triggers/R"));
    expect(z).not.toBe(valueOf("Triggers/L"));
  });

  it("should configure independent, non-colliding gamepad devices for player 1 and player 2", async () => {
    jest.spyOn(child_process, "spawnSync").mockImplementation((_cmd, args) => {
      const argv = (args as string[]) ?? [];
      const idx = argv.includes("--index") ? argv[argv.indexOf("--index") + 1] : "0";
      return {
        stdout: JSON.stringify({ ok: true, guid: `guid-${idx}`, name: `Pad ${idx}`, port: Number(idx), binds: {} }),
      } as unknown as ReturnType<typeof child_process.spawnSync>;
    });

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const gamepadFace = {
      type: "face" as const,
      primary: { type: "gp_button" as const, token: "GP_A" as const },
    };
    svc.saveConsoleLayout({
      consoleId: "gc",
      profileId: profile.id,
      player1: { ...profile.player1, face: gamepadFace },
      player2: { ...profile.player1, face: gamepadFace },
      controllerId: "gamepad",
    });

    const game: Game = {
      id: "melee",
      title: "Super Smash Bros. Melee",
      filePath: "/roms/melee.iso",
      consoleId: "gc",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    const gcPadText = fs.readFileSync(path.join(configDir, "GCPadNew.ini"), "utf-8");

    const p1Section = gcPadText.split(/\[GCPad2\]/)[0];
    const p2Section = gcPadText.split(/\[GCPad2\]/)[1] ?? "";

    expect(p1Section).toContain("Device = SDL/0/Pad 0");
    expect(p2Section).toContain("Device = SDL/1/Pad 1");
    // The core regression: both players configured a gamepad, and they must not
    // resolve to the same physical device.
    expect(p1Section).not.toContain("Device = SDL/1/Pad 1");
  });

  it("enables GameCube controller port 2 under [Core], the only section Dolphin reads SIDevice from", async () => {
    // Regression: SIDeviceN was written under [Controls], but Dolphin reads it
    // from [Core] (Config/MainSettings.cpp: {System::Main, "Core", "SIDevice0"}).
    // Every SIDevice write was therefore silently ignored, leaving Dolphin's
    // built-in defaults in force - SIDevice0 = SIDEVICE_GC_CONTROLLER and
    // SIDevice1-3 = SIDEVICE_NONE. That is exactly why player 1 appeared to
    // work while player 2 never did, regardless of whether P2 was bound to a
    // keyboard or a gamepad: port 2 was simply never enabled.
    // 6 = SIDEVICE_GC_CONTROLLER, 0 = SIDEVICE_NONE (HW/SI/SI_Device.h).
    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const p2Keyboard = {
      ...profile.player1,
      face: { ...profile.player1.face, primary: { type: "key" as const, code: "KeyZ" } },
    };
    svc.saveConsoleLayout({
      consoleId: "gc",
      profileId: profile.id,
      player1: profile.player1,
      player2: p2Keyboard,
    });

    const game: Game = {
      id: "melee-p2",
      title: "Super Smash Bros. Melee",
      filePath: "/roms/melee.iso",
      consoleId: "gc",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    const dolphinIni = fs.readFileSync(path.join(configDir, "Dolphin.ini"), "utf-8");
    const core = iniSection(dolphinIni, "Core");

    expect(core).toContain("SIDevice0 = 6");
    expect(core).toContain("SIDevice1 = 6");
    expect(core).toContain("SIDevice2 = 0");
    // Must not be hiding in [Controls], where Dolphin would never look.
    expect(iniSection(dolphinIni, "Controls")).not.toContain("SIDevice");

    // Dolphin resolves per-game overrides by the disc's 6-char game ID, so a
    // file named after RomBox's internal UUID is dead weight - none written.
    const gameSettingsDir = path.join(configDir, "GameSettings");
    const strays = fs.existsSync(gameSettingsDir) ? fs.readdirSync(gameSettingsDir) : [];
    expect(strays).toEqual([]);
  });

  it("Mario Kart Wii: configures P1 on Classic Controller and P2 on Wii Remote + Nunchuk end-to-end", async () => {
    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const layout = svc.getConsoleLayout("wii", profile.id);

    svc.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: layout.player1,
      player2: layout.player1,
      controllerId: "classic",
      player2ControllerId: "wiimote_nunchuk",
    });

    const game: Game = {
      id: "mario-kart-wii",
      title: "Mario Kart Wii",
      filePath: "/roms/mkw.iso",
      consoleId: "wii",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    const wiiText = fs.readFileSync(path.join(configDir, "WiimoteNew.ini"), "utf-8");

    const p1Section = wiiText.split(/\[Wiimote2\]/)[0];
    const p2Section = wiiText.split(/\[Wiimote2\]/)[1] ?? "";

    expect(p1Section).toContain("Extension = Classic");
    expect(p2Section).toContain("Extension = Nunchuk");

    // Each player's slot is a Wiimote *or* a GameCube pad, never both - both
    // players here are Wiimote-family, so both wiimotes are Emulated (1) and
    // both SI ports stay off. Wiimote enablement is [WiimoteN] Source here in
    // WiimoteNew.ini (Config/WiimoteSettings.cpp), not Dolphin.ini's
    // [Controls] WiimoteSourceN, which Dolphin never reads - the reason Wii
    // player 2 was never enabled at all.
    expect(iniSection(wiiText, "Wiimote1")).toContain("Source = 1");
    expect(iniSection(wiiText, "Wiimote2")).toContain("Source = 1");
    expect(iniSection(wiiText, "Wiimote3")).toContain("Source = 0");

    const dolphinIni = fs.readFileSync(path.join(configDir, "Dolphin.ini"), "utf-8");
    const core = iniSection(dolphinIni, "Core");
    expect(core).toContain("SIDevice0 = 0");
    expect(core).toContain("SIDevice1 = 0");
  });

  it("enables SIDevice (not WiimoteSource) for a player using a real GameCube controller on a Wii game", async () => {
    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const layout = svc.getConsoleLayout("wii", profile.id);

    svc.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: layout.player1,
      player2: layout.player1,
      controllerId: "wiimote",
      player2ControllerId: "gamecube",
    });

    const game: Game = {
      id: "mario-kart-wii-gc",
      title: "Mario Kart Wii",
      filePath: "/roms/mkw.iso",
      consoleId: "wii",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    const dolphinIni = fs.readFileSync(path.join(configDir, "Dolphin.ini"), "utf-8");
    const wiiText = fs.readFileSync(path.join(configDir, "WiimoteNew.ini"), "utf-8");

    // P2 is a real GameCube pad on a Wii game: SI port 2 on, wiimote 2 off.
    expect(iniSection(dolphinIni, "Core")).toContain("SIDevice1 = 6");
    expect(iniSection(wiiText, "Wiimote2")).toContain("Source = 0");
    // ...while P1 (a Wiimote) is the mirror image.
    expect(iniSection(dolphinIni, "Core")).toContain("SIDevice0 = 0");
    expect(iniSection(wiiText, "Wiimote1")).toContain("Source = 1");
  });

  it("assigns the sole connected controller to a gamepad player 2 when player 1 is on keyboard", async () => {
    // Regression: the controller index came from the player *slot* index, but
    // physical controllers are enumerated independently of slots - a
    // keyboard-bound player consumes no controller. With P1 on keyboard and
    // P2 on the user's only gamepad, P2 asked the probe for controller #1
    // when the controller it should use is #0, so it got a device string
    // naming a controller that doesn't exist ("SDL/1/Gamepad") and went dead.
    jest.spyOn(child_process, "spawnSync").mockImplementation((_cmd, args) => {
      const argv = (args as string[]) ?? [];
      const idx = argv.includes("--index") ? argv[argv.indexOf("--index") + 1] : "0";
      // Exactly one controller is plugged in: index 0 resolves, index 1 doesn't.
      return {
        stdout: idx === "0"
          ? JSON.stringify({ ok: true, guid: "g", name: "PS5 Controller", port: 0, binds: {} })
          : JSON.stringify({ ok: false, error: "no-controller" }),
      } as unknown as ReturnType<typeof child_process.spawnSync>;
    });

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const gamepadP2 = {
      ...profile.player1,
      face: { type: "face" as const, primary: { type: "gp_button" as const, token: "GP_A" as const } },
    };
    svc.saveConsoleLayout({
      consoleId: "gc",
      profileId: profile.id,
      player1: profile.player1, // keyboard (default bindings)
      player2: gamepadP2,
    });

    const game: Game = {
      id: "melee-kbd-p1",
      title: "Super Smash Bros. Melee",
      filePath: "/roms/melee.iso",
      consoleId: "gc",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
    };
    await new DolphinConfigurator(game).configure();

    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    const gcPadText = fs.readFileSync(path.join(configDir, "GCPadNew.ini"), "utf-8");

    expect(iniSection(gcPadText, "GCPad1")).toContain("Device = Quartz/0/Keyboard & Mouse");
    expect(iniSection(gcPadText, "GCPad2")).toContain("Device = SDL/0/PS5 Controller");
    expect(gcPadText).not.toContain("SDL/1/Gamepad");
  });

  it("removes a stale IR/Tilt pointer binding already on disk when a player is on Classic Controller", async () => {
    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    fs.mkdirSync(configDir, { recursive: true });

    // Simulate a WiimoteNew.ini left over from before this player's controller
    // was Classic Controller (an earlier RomBox version, or a prior switch away
    // from Wiimote mode) - this is the exact state the user reported: RomBox no
    // longer *writes* an IR binding, but never removed the old one either.
    fs.writeFileSync(
      path.join(configDir, "WiimoteNew.ini"),
      [
        "[Wiimote1]",
        "Device = SDL/0/Pad",
        "Extension = Classic",
        "IR/Up = `Right Y+`",
        "IR/Down = `Right Y-`",
        "IR/Left = `Right X-`",
        "IR/Right = `Right X+`",
        "Tilt/Forward = `Right Y+`",
        "Buttons/A = `Button S`",
      ].join("\n")
    );

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const layout = svc.getConsoleLayout("wii", profile.id);
    svc.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: layout.player1,
      controllerId: "classic",
    });

    const game: Game = {
      id: "mario-kart-wii",
      title: "Mario Kart Wii",
      filePath: "/roms/mkw.iso",
      consoleId: "wii",
      engineId: "dolphin",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
    };
    const configurator = new DolphinConfigurator(game);
    await configurator.configure();

    const wiiText = fs.readFileSync(path.join(configDir, "WiimoteNew.ini"), "utf-8");
    const p1Section = wiiText.split(/\[Wiimote2\]/)[0];

    // Cleared with an explicit empty assignment (Dolphin's own "unbound"
    // convention) rather than removed outright - the old non-empty values
    // must be gone either way.
    expect(p1Section).toMatch(/^IR\/Up\s*=\s*$/m);
    expect(p1Section).toMatch(/^IR\/Down\s*=\s*$/m);
    expect(p1Section).toMatch(/^IR\/Left\s*=\s*$/m);
    expect(p1Section).toMatch(/^IR\/Right\s*=\s*$/m);
    expect(p1Section).toMatch(/^Tilt\/Forward\s*=\s*$/m);
    expect(p1Section).toMatch(/^Buttons\/A\s*=\s*$/m);

    expect(p1Section).not.toContain("Right Y+");
    expect(p1Section).not.toContain("`Button S`");
  });
});
