import { getConsoleDigital, setConsoleDigital, clearConsoleDigital } from "../../../../src/renderer/controls/consolePath";
import type { AnyConsoleLayout, DigitalBinding } from "../../../../src/shared/types/controls";

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
