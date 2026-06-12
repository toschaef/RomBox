jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata"),
  };
});

import path from "path";
import fs from "fs";
import { ipcMain as electronIpcMain } from "electron";
const ipcMain = electronIpcMain as unknown as typeof import("../__mocks__/electron").ipcMain;
import { initDB } from "../../src/main/data/db";
import registerControlsHandlers from "../../src/main/ipc/controlsHandler";
import type { PlayerBindings } from "../../src/shared/types/controls";

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
    const defaultProfile = (await ipcMain._invoke("controls:getDefaultProfile")) as { id: string; name: string; isDefault: boolean };
    expect(defaultProfile).toBeDefined();
    expect(defaultProfile.isDefault).toBe(true);

    // 2. Create custom profile
    const customProfile = (await ipcMain._invoke("controls:createProfile", {
      name: "Custom Profile",
      makeDefault: false
    })) as { id: string; name: string; isDefault: boolean };
    expect(customProfile.name).toBe("Custom Profile");
    expect(customProfile.isDefault).toBe(false);

    // 3. Rename custom profile
    const renamedProfile = (await ipcMain._invoke("controls:renameProfile", {
      id: customProfile.id,
      name: "Custom Renamed"
    })) as { id: string; name: string; isDefault: boolean };
    expect(renamedProfile.name).toBe("Custom Renamed");

    // Verify rename took place
    const updatedProfile = (await ipcMain._invoke("controls:getProfile", customProfile.id)) as { id: string; name: string; isDefault: boolean };
    expect(updatedProfile.name).toBe("Custom Renamed");

    // 4. Set as default profile
    const setDefaultRes = (await ipcMain._invoke("controls:setDefault", customProfile.id)) as { id: string };
    expect(setDefaultRes.id).toBe(customProfile.id);
    
    const newDefault = (await ipcMain._invoke("controls:getDefaultProfile")) as { id: string };
    expect(newDefault.id).toBe(customProfile.id);

    // 5. Delete profile
    const deleteRes = (await ipcMain._invoke("controls:deleteProfile", defaultProfile.id)) as { ok: boolean };
    expect(deleteRes.ok).toBe(true);

    const allProfiles = (await ipcMain._invoke("controls:getProfiles")) as { id: string }[];
    expect(allProfiles.length).toBe(1);
    expect(allProfiles[0].id).toBe(customProfile.id);
  });

  it("should get, save, and reset console layouts via IPC", async () => {
    // 1. Get default profile
    const defaultProfile = (await ipcMain._invoke("controls:getDefaultProfile")) as { id: string };

    // 2. Get console layout for NES
    const layout = (await ipcMain._invoke("controls:getConsoleLayout", {
      consoleId: "nes",
      profileId: defaultProfile.id
    })) as { consoleId: string; isUserModified: boolean; bindings: PlayerBindings };

    expect(layout.consoleId).toBe("nes");
    expect(layout.isUserModified).toBe(false);

    // 3. Save console layout
    const customBindings = {
      ...layout.bindings,
      face: {
        ...layout.bindings.face,
        primary: { type: "key", code: "KeyZ" }
      }
    };

    const savedLayout = (await ipcMain._invoke("controls:saveConsoleLayout", {
      consoleId: "nes",
      profileId: defaultProfile.id,
      bindings: customBindings
    })) as { consoleId: string; isUserModified: boolean; bindings: PlayerBindings };

    expect(savedLayout.isUserModified).toBe(true);
    expect(savedLayout.bindings.face.primary).toEqual({ type: "key", code: "KeyZ" });

    // 4. Get all console layouts for profile
    const layouts = (await ipcMain._invoke("controls:getConsoleLayouts", defaultProfile.id)) as { console_id: string }[];
    expect(layouts.length).toBeGreaterThan(0);
    expect(layouts.some(l => l.console_id === "nes")).toBe(true);

    // 5. Reset console layout
    const resetLayout = (await ipcMain._invoke("controls:resetConsoleLayout", {
      consoleId: "nes",
      profileId: defaultProfile.id
    })) as { consoleId: string; isUserModified: boolean };

    expect(resetLayout.isUserModified).toBe(false);

    // Verify it was reset in the DB
    const fetchedLayout = (await ipcMain._invoke("controls:getConsoleLayout", {
      consoleId: "nes",
      profileId: defaultProfile.id
    })) as { isUserModified: boolean };
    expect(fetchedLayout.isUserModified).toBe(false);
  });
});
