import { SettingsService } from "../../../src/main/services/SettingsService";
import { initDB, getDB } from "../../../src/main/data/db";
import { SETTINGS_DEFAULTS } from "../../../src/shared/settings";

describe("SettingsService", () => {
  let service: SettingsService;

  beforeEach(() => {
    // Reset database state before each test
    try {
      const db = getDB();
      db.prepare("DELETE FROM settings").run();
    } catch {
      initDB();
      const db = getDB();
      db.prepare("DELETE FROM settings").run();
    }
    service = new SettingsService();
  });

  it("should ensure defaults are populated when queried", () => {
    const fullscreen = service.get("ui.fullscreen");
    expect(fullscreen).toBe(SETTINGS_DEFAULTS["ui.fullscreen"]);
    
    // Check setting table count
    const db = getDB();
    const countRow = db.prepare("SELECT COUNT(*) as count FROM settings").get() as { count: number };
    expect(countRow.count).toBeGreaterThan(0);
  });

  it("should set and get a specific setting correctly", () => {
    service.set("ui.fullscreen", true);
    expect(service.get("ui.fullscreen")).toBe(true);

    service.set("ui.fullscreen", false);
    expect(service.get("ui.fullscreen")).toBe(false);
  });

  it("should throw error for invalid setting value types", () => {
    expect(() => {
      // @ts-expect-error - testing runtime type validation
      service.set("ui.fullscreen", "not-a-boolean");
    }).toThrow('Invalid value for setting "ui.fullscreen"');
  });

  it("should support fetching multiple settings via getMany", () => {
    service.set("ui.fullscreen", true);
    service.set("launch.closeOnExit", false);

    const result = service.getMany(["ui.fullscreen", "launch.closeOnExit"]);
    expect(result).toEqual({
      "ui.fullscreen": true,
      "launch.closeOnExit": false
    });
  });

  it("should support saving multiple settings via setMany", () => {
    service.setMany({
      "ui.fullscreen": true,
      "launch.closeOnExit": true
    });

    expect(service.get("ui.fullscreen")).toBe(true);
    expect(service.get("launch.closeOnExit")).toBe(true);
  });

  it("should throw error in setMany for invalid configurations", () => {
    expect(() => {
      service.setMany({
        // @ts-expect-error - testing runtime verification
        "ui.fullscreen": "invalid"
      });
    }).toThrow('Invalid value for setting "ui.fullscreen"');
  });

  it("should reset a single setting to default", () => {
    service.set("ui.fullscreen", !SETTINGS_DEFAULTS["ui.fullscreen"]);
    service.reset("ui.fullscreen");
    expect(service.get("ui.fullscreen")).toBe(SETTINGS_DEFAULTS["ui.fullscreen"]);
  });

  it("should reset all settings to defaults", () => {
    service.set("ui.fullscreen", !SETTINGS_DEFAULTS["ui.fullscreen"]);
    service.set("launch.closeOnExit", !SETTINGS_DEFAULTS["launch.closeOnExit"]);

    service.reset();
    expect(service.get("ui.fullscreen")).toBe(SETTINGS_DEFAULTS["ui.fullscreen"]);
    expect(service.get("launch.closeOnExit")).toBe(SETTINGS_DEFAULTS["launch.closeOnExit"]);
  });
});
