jest.mock("os", () => {
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../../temp-userdata"),
  };
});

import path from "path";
import fs from "fs";
import { initDB } from "../../../src/main/data/db";
import { getConfigurator } from "../../../src/main/utils/configurators";
import { MesenConfigurator } from "../../../src/main/utils/configurators/MesenConfigurator";
import { MelonDSConfigurator } from "../../../src/main/utils/configurators/MelonDSConfigurator";
import { AzaharConfigurator } from "../../../src/main/utils/configurators/AzaharConfigurator";
import { DolphinConfigurator } from "../../../src/main/utils/configurators/DolphinConfigurator";
import { AresConfigurator } from "../../../src/main/utils/configurators/AresConfigurator";
import { DuckStationConfigurator } from "../../../src/main/utils/configurators/DuckStationConfigurator";
import { PCSX2Configurator } from "../../../src/main/utils/configurators/PCSX2Configurator";
import type { Game } from "../../../src/shared/types";

describe("Configurator Lookup", () => {
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

  it("should get the correct configurator for each console", () => {
    const dummyGame = (consoleId: string): Game => ({
      id: "dummy",
      title: "Dummy",
      filePath: "/dummy.rom",
      engineId: "mesen",
      playtimeSeconds: 0,
      lastPlayedAt: 0,
      consoleId: consoleId as any
    });

    expect(getConfigurator(dummyGame("nes"))).toBeInstanceOf(MesenConfigurator);
    expect(getConfigurator(dummyGame("ds"))).toBeInstanceOf(MelonDSConfigurator);
    expect(getConfigurator(dummyGame("3ds"))).toBeInstanceOf(AzaharConfigurator);
    expect(getConfigurator(dummyGame("gc"))).toBeInstanceOf(DolphinConfigurator);
    expect(getConfigurator(dummyGame("n64"))).toBeInstanceOf(AresConfigurator);
    expect(getConfigurator(dummyGame("ps1"))).toBeInstanceOf(DuckStationConfigurator);
    expect(getConfigurator(dummyGame("ps2"))).toBeInstanceOf(PCSX2Configurator);
    expect(getConfigurator(dummyGame("snes"))).toBeInstanceOf(MesenConfigurator);
    expect(getConfigurator(dummyGame("unknown"))).toBeNull();
  });
});
