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
import { DuckStationConfigurator } from "../../../src/main/utils/configurators/DuckStationConfigurator";

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
    const duckDir = path.join(tempDir, "Library/Application Support/DuckStation");
    expect(fs.existsSync(duckDir)).toBe(true);
  });
});
