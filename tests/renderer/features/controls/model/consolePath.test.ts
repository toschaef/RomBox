import { getConsoleDigital, setConsoleDigital, clearConsoleDigital, specialTypeForConsole } from "../../../../../src/renderer/features/controls/model/consolePath";
import type { AnyConsoleLayout, DigitalBinding } from "../../../../../src/shared/types/controls";

describe("consolePath", () => {
  const mockLayout: AnyConsoleLayout = {
    consoleId: "nes",
    name: "Nintendo",
    player1: {
      a: { type: "key", code: "KeyZ" },
      shoulders: {
        bumperL: { type: "gp_button", token: "GP_L1" }
      }
    }
  } as unknown as AnyConsoleLayout;

  describe("getConsoleDigital", () => {
    it("should resolve flat bindings directly", () => {
      const binding = getConsoleDigital(mockLayout, "player1", "a");
      expect(binding).toEqual({ type: "key", code: "KeyZ" });
    });

    it("should resolve dotted/nested group bindings", () => {
      const binding = getConsoleDigital(mockLayout, "player1", "shoulders.bumperL");
      expect(binding).toEqual({ type: "gp_button", token: "GP_L1" });
    });

    it("should return undefined if path does not exist", () => {
      expect(getConsoleDigital(mockLayout, "player1", "nonexistent")).toBeUndefined();
      expect(getConsoleDigital(mockLayout, "player1", "shoulders.nonexistent")).toBeUndefined();
    });
  });

  describe("setConsoleDigital", () => {
    it("should set flat bindings correctly", () => {
      const nextValue: DigitalBinding = { type: "key", code: "KeyX" };
      const updated = setConsoleDigital(mockLayout, "player1", "b", nextValue);

      expect(getConsoleDigital(updated, "player1", "b")).toEqual(nextValue);
      // Verify original is untouched (pure function / structuredClone)
      expect(getConsoleDigital(mockLayout, "player1", "b")).toBeUndefined();
    });

    it("should set dotted/nested group bindings correctly", () => {
      const nextValue: DigitalBinding = { type: "key", code: "KeyC" };
      const updated = setConsoleDigital(mockLayout, "player1", "shoulders.bumperR", nextValue);

      expect(getConsoleDigital(updated, "player1", "shoulders.bumperR")).toEqual(nextValue);
      expect(getConsoleDigital(mockLayout, "player1", "shoulders.bumperR")).toBeUndefined();
    });

    it("should seed a freshly-created 'special' group with the console's discriminant type", () => {
      // Regression: binding N64's Z button via the console layout UI used to create
      // `special` as a bare {} with no `type` field. Every translator gates its
      // special-binding handling on `special.type === "n64"` (etc), so the binding
      // was silently dropped and fell back to a default that could collide with a
      // completely different player's binding of the same physical input.
      const n64Layout: AnyConsoleLayout = { ...mockLayout, consoleId: "n64" };
      const nextValue: DigitalBinding = { type: "gp_button", token: "GP_L2" };
      const updated = setConsoleDigital(n64Layout, "player1", "special.z", nextValue);

      expect((updated.player1 as unknown as { special: { type: string } }).special.type).toBe("n64");
      expect(getConsoleDigital(updated, "player1", "special.z")).toEqual(nextValue);
    });

    it("should not overwrite an already-typed 'special' group", () => {
      const n64Layout: AnyConsoleLayout = {
        ...mockLayout,
        consoleId: "n64",
        player1: { ...mockLayout.player1, special: { type: "n64", z: { type: "key", code: "KeyZ" } } },
      } as unknown as AnyConsoleLayout;
      const nextValue: DigitalBinding = { type: "gp_button", token: "GP_L2" };
      const updated = setConsoleDigital(n64Layout, "player1", "special.z", nextValue);

      expect((updated.player1 as unknown as { special: { type: string } }).special.type).toBe("n64");
    });
  });

  describe("specialTypeForConsole", () => {
    it("maps n64/gc/wii to their special discriminant and everything else to undefined", () => {
      expect(specialTypeForConsole("n64")).toBe("n64");
      expect(specialTypeForConsole("gc")).toBe("gc");
      expect(specialTypeForConsole("wii")).toBe("wii");
      expect(specialTypeForConsole("nes")).toBeUndefined();
    });
  });

  describe("clearConsoleDigital", () => {
    it("should clear flat bindings correctly", () => {
      const updated = clearConsoleDigital(mockLayout, "player1", "a");
      expect(getConsoleDigital(updated, "player1", "a")).toBeUndefined();
      expect(getConsoleDigital(mockLayout, "player1", "a")).toEqual({ type: "key", code: "KeyZ" });
    });

    it("should clear dotted/nested bindings correctly", () => {
      const updated = clearConsoleDigital(mockLayout, "player1", "shoulders.bumperL");
      expect(getConsoleDigital(updated, "player1", "shoulders.bumperL")).toBeUndefined();
      expect(getConsoleDigital(mockLayout, "player1", "shoulders.bumperL")).toEqual({ type: "gp_button", token: "GP_L1" });
    });
  });
});
