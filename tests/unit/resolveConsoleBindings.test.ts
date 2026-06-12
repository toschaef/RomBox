import { ControlsService } from "../../src/main/services/ControlsService";
import { initDB, getDB } from "../../src/main/data/db";

describe("getEffectiveConsoleBindings", () => {
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

  it("should return saved consoleLayout bindings if they exist", async () => {
    const profile = service.getDefaultProfile();
    
    // Save customized layout
    const layout = service.getConsoleLayout("nes", profile.id);
    const customBindings = {
      ...layout.bindings,
      face: {
        ...layout.bindings.face,
        primary: { type: "key" as const, code: "KeyZ" }
      }
    };
    
    service.saveConsoleLayout({
      consoleId: "nes",
      profileId: profile.id,
      bindings: customBindings
    });

    const result = await service.getEffectiveConsoleBindings("nes", profile.id);

    expect(result.face?.primary).toEqual({ type: "key", code: "KeyZ" });
  });

  it("should fall back to default console bindings if layout has no customized bindings or is new", async () => {
    const profile = service.getDefaultProfile();
    const result = await service.getEffectiveConsoleBindings("nes", profile.id);

    expect(result).toBeDefined();
    // Default NES move bindings should be mapped as a dpad
    expect(result.move).toBeDefined();
  });
});
