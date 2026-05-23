jest.mock("os", () => {
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata"),
  };
});

import path from "path";
import fs from "fs";
const ipcMain = require("electron").ipcMain as any;
import { initDB } from "../../src/main/data/db";
import registerControlsHandlers from "../../src/main/ipc/controlsHandler";

describe("IPC Controls Handler Integration Tests", () => {
  const tempDir = path.resolve(__dirname, "../temp-userdata");

  beforeAll(() => {
    registerControlsHandlers();
  });

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    ipcMain._clearHandlers();
  });

  it("should create, list, rename, and delete profiles via IPC", async () => {
    // 1. Get default profile (created on init)
    const defaultProfile = await ipcMain._invoke("controls:getDefaultProfile");
    expect(defaultProfile).toBeDefined();
    expect(defaultProfile.isDefault).toBe(true);

    // 2. Create custom profile
    const customProfile = await ipcMain._invoke("controls:createProfile", {
      name: "Custom Profile",
      makeDefault: false
    });
    expect(customProfile.name).toBe("Custom Profile");
    expect(customProfile.isDefault).toBe(false);

    // 3. Rename custom profile
    const renamedProfile = await ipcMain._invoke("controls:renameProfile", {
      id: customProfile.id,
      name: "Custom Renamed"
    });
    expect(renamedProfile.name).toBe("Custom Renamed");

    // Verify rename took place
    const updatedProfile = await ipcMain._invoke("controls:getProfile", customProfile.id);
    expect(updatedProfile.name).toBe("Custom Renamed");

    // 4. Set as default profile
    const setDefaultRes = await ipcMain._invoke("controls:setDefault", customProfile.id);
    expect(setDefaultRes.id).toBe(customProfile.id);
    
    const newDefault = await ipcMain._invoke("controls:getDefaultProfile");
    expect(newDefault.id).toBe(customProfile.id);

    // 5. Delete profile
    const deleteRes = await ipcMain._invoke("controls:deleteProfile", defaultProfile.id);
    expect(deleteRes.ok).toBe(true);

    const allProfiles = await ipcMain._invoke("controls:getProfiles");
    expect(allProfiles.length).toBe(1);
    expect(allProfiles[0].id).toBe(customProfile.id);
  });
});
