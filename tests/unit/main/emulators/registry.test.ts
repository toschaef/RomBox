jest.mock("os", () => {
  return {
    ...jest.requireActual("os"),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    homedir: () => require("../../../helpers/tempDirs").suiteUserDataDir(),
  };
});

import { suiteUserDataDir } from "../../../helpers/tempDirs";
import fs from "fs";
import { CONSOLE_CATALOG } from "../../../../src/shared/emulators/catalog";
import { initDB } from "../../../../src/main/data/db";
import { getConfigurator } from "../../../../src/main/emulators";
import { MesenConfigurator } from "../../../../src/main/emulators/mesen/configurator";
import { MelonDSConfigurator } from "../../../../src/main/emulators/melonds/configurator";
import { AzaharConfigurator } from "../../../../src/main/emulators/azahar/configurator";
import { DolphinConfigurator } from "../../../../src/main/emulators/dolphin/configurator";
import { AresConfigurator } from "../../../../src/main/emulators/ares/configurator";
import { DuckStationConfigurator } from "../../../../src/main/emulators/duckstation/configurator";
import { PCSX2Configurator } from "../../../../src/main/emulators/pcsx2/configurator";
import type { Game, ConsoleID } from "../../../../src/shared/types";

describe("Configurator Lookup", () => {
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

  it("should get the correct configurator for each console", () => {
    // dispatch keys on engineId, so the fixture derives it from the console
    // the same way the scanner does when a game is imported.
    const dummyGame = (consoleId: string): Game => ({
      id: "dummy",
      title: "Dummy",
      filePath: "/dummy.rom",
      engineId: CONSOLE_CATALOG[consoleId as ConsoleID]?.engineId,
      playtimeSeconds: 0,
      lastPlayedAt: 0,
      consoleId: consoleId as ConsoleID
    });

    expect(getConfigurator(dummyGame("nes"))).toBeInstanceOf(MesenConfigurator);
    expect(getConfigurator(dummyGame("ds"))).toBeInstanceOf(MelonDSConfigurator);
    expect(getConfigurator(dummyGame("3ds"))).toBeInstanceOf(AzaharConfigurator);
    expect(getConfigurator(dummyGame("gc"))).toBeInstanceOf(DolphinConfigurator);
    expect(getConfigurator(dummyGame("n64"))).toBeInstanceOf(AresConfigurator);
    expect(getConfigurator(dummyGame("ps1"))).toBeInstanceOf(DuckStationConfigurator);
    expect(getConfigurator(dummyGame("ps2"))).toBeInstanceOf(PCSX2Configurator);
    expect(getConfigurator(dummyGame("snes"))).toBeInstanceOf(MesenConfigurator);
    // an unrecognized engine yields no configurator rather than throwing.
    expect(getConfigurator(dummyGame("unknown"))).toBeNull();
  });
});
