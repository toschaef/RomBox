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
import { MesenConfigurator } from "../../../src/main/utils/configurators/MesenConfigurator";

describe("MesenConfigurator", () => {
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

  it("should configure MesenConfigurator", async () => {
    const configurator = new MesenConfigurator("nes");
    await configurator.configure();
    const settingsJson = path.join(tempDir, "Library/Application Support/Mesen2/settings.json");
    expect(fs.existsSync(settingsJson)).toBe(true);
  });
});
