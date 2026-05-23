import { getConsoleDigital, setConsoleDigital, clearConsoleDigital } from "../../../../src/renderer/controls/consolePath";
import type { AnyConsoleLayout, DigitalBinding } from "../../../../src/shared/types/controls";

describe("consolePath", () => {
  const mockLayout: AnyConsoleLayout = {
    consoleId: "nes",
    name: "Nintendo",
    bindings: {
      a: { type: "key", code: "KeyZ" },
      shoulders: {
        bumperL: { type: "gp_button", token: "GP_L1" }
      }
    }
  } as any;

  describe("getConsoleDigital", () => {
    it("should resolve flat bindings directly", () => {
      const binding = getConsoleDigital(mockLayout, "a");
      expect(binding).toEqual({ type: "key", code: "KeyZ" });
    });

    it("should resolve dotted/nested group bindings", () => {
      const binding = getConsoleDigital(mockLayout, "shoulders.bumperL");
      expect(binding).toEqual({ type: "gp_button", token: "GP_L1" });
    });

    it("should return undefined if path does not exist", () => {
      expect(getConsoleDigital(mockLayout, "nonexistent")).toBeUndefined();
      expect(getConsoleDigital(mockLayout, "shoulders.nonexistent")).toBeUndefined();
    });
  });

  describe("setConsoleDigital", () => {
    it("should set flat bindings correctly", () => {
      const nextValue: DigitalBinding = { type: "key", code: "KeyX" };
      const updated = setConsoleDigital(mockLayout, "b", nextValue);

      expect(getConsoleDigital(updated, "b")).toEqual(nextValue);
      // Verify original is untouched (pure function / structuredClone)
      expect(getConsoleDigital(mockLayout, "b")).toBeUndefined();
    });

    it("should set dotted/nested group bindings correctly", () => {
      const nextValue: DigitalBinding = { type: "key", code: "KeyC" };
      const updated = setConsoleDigital(mockLayout, "shoulders.bumperR", nextValue);

      expect(getConsoleDigital(updated, "shoulders.bumperR")).toEqual(nextValue);
      expect(getConsoleDigital(mockLayout, "shoulders.bumperR")).toBeUndefined();
    });
  });

  describe("clearConsoleDigital", () => {
    it("should clear flat bindings correctly", () => {
      const updated = clearConsoleDigital(mockLayout, "a");
      expect(getConsoleDigital(updated, "a")).toBeUndefined();
      expect(getConsoleDigital(mockLayout, "a")).toEqual({ type: "key", code: "KeyZ" });
    });

    it("should clear dotted/nested bindings correctly", () => {
      const updated = clearConsoleDigital(mockLayout, "shoulders.bumperL");
      expect(getConsoleDigital(updated, "shoulders.bumperL")).toBeUndefined();
      expect(getConsoleDigital(mockLayout, "shoulders.bumperL")).toEqual({ type: "gp_button", token: "GP_L1" });
    });
  });
});
