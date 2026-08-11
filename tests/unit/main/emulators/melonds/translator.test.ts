import { MelonDSTranslator } from "../../../../../src/main/emulators/melonds/translator";
import { createDefaultProfileShape } from "../../../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile } from "../../../../../src/shared/types/controls";
import type { TranslateContext } from "../../../../../src/main/emulators/translatorTypes";

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
    const result = translator.translate({ ...profile, melonJoystickId: 0 }, context);
    expect(result.length).toBeGreaterThan(0);

    // Verify key mappings
    // face.primary is 'KeyU' -> A is 'U' -> 85
    const keyA = result.find(p => p.kind === "ini-set" && p.section === "Instance0.Keyboard" && p.key === "A");
    expect(keyA).toBeDefined();
    if (keyA && keyA.kind === "ini-set") {
      expect(keyA.value).toBe("85");
    }

    const keyKeyA = result.find(p => p.kind === "ini-set" && p.section === "" && p.key === "Key_A");
    expect(keyKeyA).toBeDefined();
    if (keyKeyA && keyKeyA.kind === "ini-set") {
      expect(keyKeyA.value).toBe("85");
    }

    // system.start is 'KeyT' -> Start is 'T' -> 84
    const keyStart = result.find(p => p.kind === "ini-set" && p.section === "Instance0.Keyboard" && p.key === "Start");
    expect(keyStart).toBeDefined();
    if (keyStart && keyStart.kind === "ini-set") {
      expect(keyStart.value).toBe("84");
    }

    // dpad.up is 'Digit3' -> Up is '3' -> 51
    const keyUp = result.find(p => p.kind === "ini-set" && p.section === "Instance0.Keyboard" && p.key === "Up");
    expect(keyUp).toBeDefined();
    if (keyUp && keyUp.kind === "ini-set") {
      expect(keyUp.value).toBe("51");
    }
  });

  function keyboardCodeFor(code: string, platform: TranslateContext["platform"]): string | undefined {
    const p = {
      ...profile,
      player1: {
        ...profile.player1,
        system: { ...profile.player1.system, start: { type: "key" as const, code } },
      },
    };
    const result = new MelonDSTranslator().translate(
      { ...p, melonJoystickId: 0 },
      { ...context, platform }
    );
    const patch = result.find(
      (p) => p.kind === "ini-set" && p.section === "Instance0.Keyboard" && p.key === "Start"
    );
    return patch && patch.kind === "ini-set" ? patch.value : undefined;
  }

  // melonDS compares against Qt::Key values, not raw ASCII/VK codes - these
  // were previously wrong on every platform.
  it.each([
    ["Enter", "16777220"],
    ["NumpadEnter", "16777221"],
    ["Tab", "16777217"],
    ["Backspace", "16777219"],
    ["Escape", "16777216"],
  ])("maps %s to the real Qt::Key value %s", (code, expected) => {
    expect(keyboardCodeFor(code, "darwin")).toBe(expected);
    expect(keyboardCodeFor(code, "win32")).toBe(expected);
  });

  // Qt on Windows reports arrow keys with Qt::KeypadModifier set (a
  // long-standing Windows-only quirk); macOS does not. melonDS's own
  // onKeyPress() preserves that modifier only when present, so the two
  // platforms need different encoded values for the same key.
  it("encodes arrow keys differently per platform", () => {
    expect(keyboardCodeFor("ArrowLeft", "win32")).toBe("553648146");
    expect(keyboardCodeFor("ArrowLeft", "darwin")).toBe("16777234");
  });
});
