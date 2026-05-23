import { applyBindEventConsole, bindLabelConsole } from "../../../../src/renderer/controls/consoleBindMachine";
import type { AnyConsoleLayout } from "../../../../src/shared/types/controls";

describe("consoleBindMachine", () => {
  let mockLayout: AnyConsoleLayout;

  beforeEach(() => {
    mockLayout = {
      consoleId: "nes",
      name: "Nintendo NES",
      bindings: {
        a: { type: "key", code: "KeyZ" },
        move: { type: "dpad" }
      }
    } as any;
  });

  describe("bindLabelConsole", () => {
    it("should return empty string for inactive state", () => {
      expect(bindLabelConsole({ active: false })).toBe("");
    });

    it("should return plan path for active digital plan", () => {
      expect(bindLabelConsole({ active: true, plan: { kind: "digital", path: "a" }, step: 0, startedAt: 100 })).toBe("a");
    });

    it("should return dpad step label for active dpad plan", () => {
      expect(bindLabelConsole({ active: true, plan: { kind: "dpad", group: "move" }, step: 0, startedAt: 100 })).toBe("MOVE UP");
    });
  });

  describe("applyBindEventConsole", () => {
    it("should return null if state is inactive", () => {
      const result = applyBindEventConsole(mockLayout, { active: false }, { kind: "key", code: "KeyX", at: 200 });
      expect(result).toBeNull();
    });

    it("should return null if event timestamp is older than startedAt", () => {
      const result = applyBindEventConsole(
        mockLayout,
        { active: true, plan: { kind: "digital", path: "a" }, step: 0, startedAt: 200 },
        { kind: "key", code: "KeyX", at: 100 }
      );
      expect(result).toBeNull();
    });

    it("should cancel active binding and deactivate state on Escape key", () => {
      const result = applyBindEventConsole(
        mockLayout,
        { active: true, plan: { kind: "digital", path: "a" }, step: 0, startedAt: 100 },
        { kind: "key", code: "Escape", at: 200 }
      );
      expect(result).toEqual({
        layout: mockLayout,
        state: { active: false }
      });
    });

    it("should bind digital key on console digital plan", () => {
      const result = applyBindEventConsole(
        mockLayout,
        { active: true, plan: { kind: "digital", path: "b" }, step: 0, startedAt: 100 },
        { kind: "key", code: "KeyX", at: 200 }
      );

      expect(result).toBeDefined();
      expect(result?.state).toEqual({ active: false });
      expect((result?.layout.bindings as any).b).toEqual({ type: "key", code: "KeyX" });
    });

    it("should handle multi-step dpad binding sequence on console layout", () => {
      const state1 = { active: true as const, plan: { kind: "dpad" as const, group: "move" as const }, step: 0, startedAt: 100 };

      // Step 0: Up
      const res1 = applyBindEventConsole(mockLayout, state1, { kind: "key", code: "ArrowUp", at: 200 });
      expect(res1?.state).toEqual({ ...state1, step: 1 });
      expect((res1?.layout.bindings.move as any).up).toEqual({ type: "key", code: "ArrowUp" });

      // Step 1: Down
      const res2 = applyBindEventConsole(res1!.layout, res1!.state, { kind: "key", code: "ArrowDown", at: 300 });
      expect(res2?.state).toEqual({ ...state1, step: 2 });
      expect((res2?.layout.bindings.move as any).down).toEqual({ type: "key", code: "ArrowDown" });
    });
  });
});
