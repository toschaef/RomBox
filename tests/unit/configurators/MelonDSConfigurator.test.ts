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
import { MelonDSConfigurator } from "../../../src/main/utils/configurators/MelonDSConfigurator";

describe("MelonDSConfigurator", () => {
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

  it("should configure MelonDSConfigurator", async () => {
    const configurator = new MelonDSConfigurator();
    await configurator.configure();
    const melonDir = path.join(tempDir, "Library/Preferences/melonDS");
    expect(fs.existsSync(melonDir)).toBe(true);
  });
});
