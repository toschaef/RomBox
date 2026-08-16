// mesen/ares schema reach KeycodeMapper through a runtime require() to break
// an import cycle. typescript cannot check those strings, so a file move once
// turned one into MODULE_NOT_FOUND with no test failing. this guards them.
import { getMesenKeyboardCode } from "../../../../../src/main/emulators/mesen/schema";
import { resolveAresKeyboardKeyIndex } from "../../../../../src/main/emulators/ares/schema";

describe("schema -> KeycodeMapper bridge", () => {
  describe("getMesenKeyboardCode", () => {
    it("resolves a letter key on macOS", () => {
      expect(getMesenKeyboardCode("KeyA", "darwin")).toEqual(expect.any(Number));
    });

    it("resolves a letter key on Windows", () => {
      // Mesen's Windows UI forwards Avalonia's Key enum ordinal, not a VK code.
      expect(getMesenKeyboardCode("KeyA", "win32")).toBe(44);
    });

    it("returns null for a code it cannot map", () => {
      expect(getMesenKeyboardCode("NotARealKey", "darwin")).toBeNull();
    });
  });

  describe("resolveAresKeyboardKeyIndex", () => {
    it("resolves a letter key on both platforms", () => {
      expect(resolveAresKeyboardKeyIndex("KeyA", "darwin")).toEqual(expect.any(Number));
      expect(resolveAresKeyboardKeyIndex("KeyA", "win32")).toEqual(expect.any(Number));
    });

    it("returns null for a code it cannot map", () => {
      expect(resolveAresKeyboardKeyIndex("NotARealKey", "darwin")).toBeNull();
    });
  });
});
