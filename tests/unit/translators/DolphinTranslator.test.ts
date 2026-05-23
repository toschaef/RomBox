import { DolphinTranslator } from "../../../src/main/utils/translators/DolphinTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

describe("DolphinTranslator", () => {
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
    consoleId: "gc",
  };

  it("should translate bindings via DolphinTranslator correctly", () => {
    const translator = new DolphinTranslator();
    const result = translator.translate(profile, context);
    expect(result.length).toBeGreaterThan(0);
  });
});
