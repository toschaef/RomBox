import { DuckStationTranslator } from "../../../src/main/utils/translators/DuckStationTranslator";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";

describe("DuckStationTranslator", () => {
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
    consoleId: "ps1",
  };

  it("should translate bindings via DuckStationTranslator correctly", () => {
    const translator = new DuckStationTranslator();
    const result = translator.translate(profile, context);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].kind).toBe("ini-set");
  });
});
