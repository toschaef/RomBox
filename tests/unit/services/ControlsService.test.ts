import { ControlsService } from "../../../src/main/services/ControlsService";
import { initDB, getDB } from "../../../src/main/data/db";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";

describe("ControlsService", () => {
  let service: ControlsService;

  beforeEach(() => {
    try {
      const db = getDB();
      db.prepare("DELETE FROM controller_profiles").run();
      db.prepare("DELETE FROM console_layouts").run();
    } catch {
      initDB();
      const db = getDB();
      db.prepare("DELETE FROM controller_profiles").run();
      db.prepare("DELETE FROM console_layouts").run();
    }
    service = new ControlsService();
  });

  it("should ensure a default profile is created if none exists", () => {
    const defaultId = service.ensureDefaultProfileExists();
    expect(defaultId).toBeDefined();

    const profiles = service.getProfiles();
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe(defaultId);
    expect(profiles[0].name).toBe("Default");
  });

  it("should retrieve default profile shape", () => {
    const profile = service.getDefaultProfile();
    expect(profile.name).toBe("Default");
    expect(profile.isDefault).toBe(true);
    expect(profile.player1).toEqual(createDefaultProfileShape().player1);
  });

  it("should support profile creation, renaming, and retrieval", () => {
    const profile = service.createProfile({ name: "Custom Gamepad" });
    expect(profile.id).toBeDefined();
    expect(profile.name).toBe("Custom Gamepad");
    expect(profile.isDefault).toBe(false);

    const renamed = service.renameProfile(profile.id, "Xbox Controller");
    expect(renamed.name).toBe("Xbox Controller");

    const fetched = service.getProfile(profile.id);
    expect(fetched.name).toBe("Xbox Controller");
  });

  it("should change default profiles and enforce unique constraint", () => {
    const defaultId = service.ensureDefaultProfileExists();
    const profile1 = service.createProfile({ name: "Profile 1" });

    service.setDefault(profile1.id);

    const fetched1 = service.getProfile(profile1.id);
    expect(fetched1.isDefault).toBe(true);

    const fetchedDefault = service.getProfile(defaultId);
    expect(fetchedDefault.isDefault).toBe(false);
  });

  it("should get and save console bindings layout", () => {
    const profile = service.getDefaultProfile();
    
    // Get layout (should automatically create if not found)
    const layout = service.getConsoleLayout("nes", profile.id);
    expect(layout.consoleId).toBe("nes");
    expect(layout.isUserModified).toBe(false);

    // Save customized layout
    const customBindings = {
      ...layout.bindings,
      face: {
        ...layout.bindings.face,
        primary: { type: "key" as const, code: "KeyZ" }
      }
    };
    
    const saved = service.saveConsoleLayout({
      consoleId: "nes",
      profileId: profile.id,
      bindings: customBindings
    });

    expect(saved.isUserModified).toBe(true);
    expect(saved.bindings.face?.primary).toEqual({ type: "key", code: "KeyZ" });
  });

  it("should delete profile and fallback to another default profile", () => {
    const defaultId = service.ensureDefaultProfileExists();
    const profile1 = service.createProfile({ name: "To Delete", makeDefault: true });

    service.deleteProfile(profile1.id);

    const profiles = service.getProfiles();
    expect(profiles.some(p => p.id === profile1.id)).toBe(false);
    expect(profiles.some(p => p.id === defaultId)).toBe(true);
  });
});
