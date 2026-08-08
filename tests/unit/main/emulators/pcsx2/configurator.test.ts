jest.mock("os", () => {
  return {
    ...jest.requireActual("os"),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    homedir: () => require("../../../../helpers/tempDirs").suiteUserDataDir(),
  };
});

import { suiteUserDataDir } from "../../../../helpers/tempDirs";
import path from "path";
import fs from "fs";
import { initDB } from "../../../../../src/main/data/db";
import { PCSX2Configurator } from "../../../../../src/main/emulators/pcsx2/configurator";
import { ControlsService } from "../../../../../src/main/services/ControlsService";
import { osHandler } from "../../../../../src/main/platform";

describe("PCSX2Configurator", () => {
  const tempDir = suiteUserDataDir();

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should configure PCSX2Configurator", async () => {
    const configurator = new PCSX2Configurator();
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("pcsx2");
    const pcsx2Ini = path.join(configDir, "PCSX2.ini");
    expect(fs.existsSync(pcsx2Ini)).toBe(true);

    const iniText = fs.readFileSync(pcsx2Ini, "utf-8");
    // Verify specific sections and parameters
    expect(iniText).toContain("[UI]");
    expect(iniText).toContain("StartFullscreen = false");
    expect(iniText).toContain("ConfirmShutdown = false");

    expect(iniText).toContain("[EmuCore/GS]");
    expect(iniText).toContain("upscale_multiplier = 1");

    expect(iniText).toContain("[Pad1]");
    expect(iniText).toContain("Cross = Keyboard/U");
    expect(iniText).toContain("Start = Keyboard/T");
    expect(iniText).toContain("Up = Keyboard/3");

    // No player2 configured - port 2 must stay disabled.
    const pad2Section = iniText.split(/\[Pad2\]/)[1] ?? "";
    expect(pad2Section).toContain("Type = None");

    const pad1Section = iniText.split(/\[Pad1\]/)[1]?.split(/\n\[/)[0] ?? "";
    expect(pad1Section).toContain("Analog = SDL-0/Guide");
    expect(pad1Section).not.toContain("Keyboard/M");
  });

  it("enables [Pad2] Type=DualShock2 when a second player is configured", async () => {
    // Regression: PCSX2 only instantiates a controller for a port whose
    // [PadN] Type is not "None" - bindings written under a None-typed port
    // are silently ignored. Pad2's Type was previously hardcoded to "None"
    // unconditionally, so player 2's controls never worked in PCSX2
    // regardless of what was bound to them.
    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const p2Keyboard = {
      ...profile.player1,
      face: { ...profile.player1.face, primary: { type: "key" as const, code: "KeyZ" } },
    };
    svc.saveConsoleLayout({
      consoleId: "ps2",
      profileId: profile.id,
      player1: profile.player1,
      player2: p2Keyboard,
    });

    const configurator = new PCSX2Configurator();
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("pcsx2");
    const pcsx2Ini = path.join(configDir, "PCSX2.ini");
    const iniText = fs.readFileSync(pcsx2Ini, "utf-8");

    const pad2Section = iniText.split(/\[Pad2\]/)[1]?.split(/\n\[/)[0] ?? "";
    expect(pad2Section).toContain("Type = DualShock2");
    expect(pad2Section).toContain("Cross = Keyboard/Z");
  });

  it("enables multitap on port 1 and [Pad3]/[Pad4] when a 3rd/4th player is configured", async () => {
    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    svc.saveConsoleLayout({
      consoleId: "ps2",
      profileId: profile.id,
      player1: profile.player1,
      player3: profile.player1,
      player4: profile.player1,
    });

    const configurator = new PCSX2Configurator();
    await configurator.configure();

    const configDir = osHandler.getEmulatorConfigPath("pcsx2");
    const pcsx2Ini = path.join(configDir, "PCSX2.ini");
    const iniText = fs.readFileSync(pcsx2Ini, "utf-8");

    const padSection = iniText.split(/\[Pad\]/)[1]?.split(/\n\[/)[0] ?? "";
    expect(padSection).toContain("MultitapPort1 = true");

    const pad3Section = iniText.split(/\[Pad3\]/)[1]?.split(/\n\[/)[0] ?? "";
    const pad4Section = iniText.split(/\[Pad4\]/)[1]?.split(/\n\[/)[0] ?? "";
    expect(pad3Section).toContain("Type = DualShock2");
    expect(pad4Section).toContain("Type = DualShock2");
  });
});
