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
import { AzaharConfigurator } from "../../../src/main/utils/configurators/AzaharConfigurator";

describe("AzaharConfigurator", () => {
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

  it("should configure AzaharConfigurator", async () => {
    const configurator = new AzaharConfigurator();
    await configurator.configure();
    const azDir = path.join(tempDir, "Library/Application Support/Azahar");
    expect(fs.existsSync(azDir)).toBe(true);
  });
});
