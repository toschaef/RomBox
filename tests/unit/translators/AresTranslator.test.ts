import { AresTranslator } from "../../../src/main/utils/translators/AresTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";

describe("AresTranslator", () => {
  const profile: ControlsProfile = {
    id: "test-profile-id",
    name: "Test Profile",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    ...createDefaultProfileShape()
  };

  it("should translate bindings via AresTranslator correctly", () => {
    const translator = new AresTranslator();
    const result = translator.translateFromPlayer(profile.player1);
    expect(result).toBeDefined();
    // Ares resolves to Quartz codes or similar keys
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });
});
