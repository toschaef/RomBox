import { MelonDSTranslator } from "../../../src/main/utils/translators/MelonDSTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

describe("MelonDSTranslator", () => {
  const profile: ControlsProfile = {
    id: "test-profile-id",
    name: "Test Profile",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    ...createDefaultProfileShape()
  };

  const context: TranslateContext = {
    platform: "darwin",
    configDir: "/mock/config/dir",
    consoleId: "ds",
  };

  it("should translate bindings via MelonDSTranslator correctly", () => {
    const translator = new MelonDSTranslator();
    const result = translator.translateFromPlayer(profile.player1, context, 0);
    expect(result.length).toBeGreaterThan(0);
  });
});
