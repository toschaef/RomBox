import { MesenTranslator } from "../../../src/main/utils/translators/MesenTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";

describe("MesenTranslator", () => {
  const profile: ControlsProfile = {
    id: "test-profile-id",
    name: "Test Profile",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    ...createDefaultProfileShape()
  };

  it("should translate bindings via MesenTranslator correctly", () => {
    const translator = new MesenTranslator();
    const result = translator.translateForDeviceFromPlayer(profile.player1, 1, "keyboard", "move");
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });
});
