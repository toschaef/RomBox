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
import { initDB } from "../../../src/main/data/db";
import { DuckStationConfigurator } from "../../../src/main/utils/configurators/DuckStationConfigurator";
import { ControlsService } from "../../../src/main/services/ControlsService";
import { osHandler } from "../../../src/main/platform";
import { DuckStation } from "../../../src/main/utils/schema/duckstation";

describe("DuckStationConfigurator", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");

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

  it("should configure DuckStationConfigurator", async () => {
    const configurator = new DuckStationConfigurator();
    await configurator.configure();

    const configDir = osHandler.getEmulatorBasePath("duckstation");
    const settingsIni = DuckStation.iniPath(configDir);
    expect(fs.existsSync(settingsIni)).toBe(true);

    const iniText = fs.readFileSync(settingsIni, "utf-8");
    // Verify specific sections and parameters
    expect(iniText).toContain("[Main]");
    expect(iniText).toContain("StartFullscreen = false");
    expect(iniText).toContain("SaveStateOnExit = true");

    expect(iniText).toContain("[GPU]");
    expect(iniText).toContain("ResolutionScale = 1");

    expect(iniText).toContain("[Display]");
    expect(iniText).toContain("Fullscreen = false");
    expect(iniText).toContain("AspectRatio = Auto");

    expect(iniText).toContain("[Pad1]");
    expect(iniText).toContain("Cross = Keyboard/U");
    expect(iniText).toContain("Start = Keyboard/T");
    expect(iniText).toContain("Up = Keyboard/3");

    // No player2 configured - port 2 must stay disabled.
    const pad2Section = iniText.split(/\[Pad2\]/)[1] ?? "";
    expect(pad2Section).toContain("Type = None");
  });

  it("enables [Pad2] Type=AnalogController when a second player is configured", async () => {
    // Regression: DuckStation only instantiates a controller for a port whose
    // [PadN] Type is not "None" - bindings written under a None-typed port are
    // silently ignored. Pad2's Type was previously hardcoded to "None"
    // unconditionally, so player 2's controls never worked in DuckStation
    // regardless of what was bound to them.
    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const p2Keyboard = {
      ...profile.player1,
      face: { ...profile.player1.face, primary: { type: "key" as const, code: "KeyZ" } },
    };
    svc.saveConsoleLayout({
      consoleId: "ps1",
      profileId: profile.id,
      player1: profile.player1,
      player2: p2Keyboard,
    });

    const configurator = new DuckStationConfigurator();
    await configurator.configure();

    const configDir = osHandler.getEmulatorBasePath("duckstation");
    const settingsIni = DuckStation.iniPath(configDir);
    const iniText = fs.readFileSync(settingsIni, "utf-8");

    const pad2Section = iniText.split(/\[Pad2\]/)[1]?.split(/\n\[/)[0] ?? "";
    expect(pad2Section).toContain("Type = AnalogController");
    expect(pad2Section).toContain("Cross = Keyboard/Z");
  });

  it("enables multitap on port 1 and [Pad3]/[Pad4] when a 3rd/4th player is configured", async () => {
    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    svc.saveConsoleLayout({
      consoleId: "ps1",
      profileId: profile.id,
      player1: profile.player1,
      player3: profile.player1,
      player4: profile.player1,
    });

    const configurator = new DuckStationConfigurator();
    await configurator.configure();

    const configDir = osHandler.getEmulatorBasePath("duckstation");
    const settingsIni = DuckStation.iniPath(configDir);
    const iniText = fs.readFileSync(settingsIni, "utf-8");

    const controllerPortsSection = iniText.split(/\[ControllerPorts\]/)[1]?.split(/\n\[/)[0] ?? "";
    expect(controllerPortsSection).toContain("MultitapMode = Port1Only");

    const pad3Section = iniText.split(/\[Pad3\]/)[1]?.split(/\n\[/)[0] ?? "";
    const pad4Section = iniText.split(/\[Pad4\]/)[1]?.split(/\n\[/)[0] ?? "";
    expect(pad3Section).toContain("Type = AnalogController");
    expect(pad4Section).toContain("Type = AnalogController");
  });
});
