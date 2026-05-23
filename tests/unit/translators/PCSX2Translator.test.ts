import { PCSX2Translator } from "../../../src/main/utils/translators/PCSX2Translator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

describe("PCSX2Translator", () => {
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
    consoleId: "ps2",
  };

  it("should translate bindings via PCSX2Translator correctly", () => {
    const translator = new PCSX2Translator();
    const result = translator.translate(profile, context);
    expect(result.length).toBeGreaterThan(0);
  });
});
