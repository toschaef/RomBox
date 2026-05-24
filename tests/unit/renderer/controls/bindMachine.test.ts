import { applyBindEvent, bindLabel } from "../../../../src/renderer/controls/bindMachine";
import type { ControlsProfile } from "../../../../src/shared/types/controls";
import { createDefaultProfileShape } from "../../../../src/shared/controls/layoutDefaults";

describe("bindMachine", () => {
  let mockProfile: ControlsProfile;

  beforeEach(() => {
    mockProfile = {
      id: "profile-id",
      name: "Default Profile",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
      // preferredDevice: "keyboard",
      ...createDefaultProfileShape(),
    };
  });

  describe("bindLabel", () => {
    it("should return empty string for inactive state", () => {
      expect(bindLabel({ active: false })).toBe("");
    });

    it("should return plan path for active digital plan", () => {
      expect(bindLabel({ active: true, plan: { kind: "digital", path: "face.primary" }, step: 0, startedAt: 100 })).toBe("face.primary");
    });

    it("should return dpad step label for active dpad plan", () => {
      expect(bindLabel({ active: true, plan: { kind: "dpad", group: "move" }, step: 0, startedAt: 100 })).toBe("MOVE UP");
      expect(bindLabel({ active: true, plan: { kind: "dpad", group: "move" }, step: 1, startedAt: 100 })).toBe("MOVE DOWN");
      expect(bindLabel({ active: true, plan: { kind: "dpad", group: "move" }, step: 2, startedAt: 100 })).toBe("MOVE LEFT");
      expect(bindLabel({ active: true, plan: { kind: "dpad", group: "move" }, step: 3, startedAt: 100 })).toBe("MOVE RIGHT");
    });

    it("should return stick step label for active stick plan", () => {
      expect(bindLabel({ active: true, plan: { kind: "stick", group: "move", stick: "left" }, step: 0, startedAt: 100 })).toBe("MOVE STICK X");
      expect(bindLabel({ active: true, plan: { kind: "stick", group: "move", stick: "left" }, step: 1, startedAt: 100 })).toBe("MOVE STICK Y");
    });
  });

  describe("applyBindEvent", () => {
    it("should return null if state is inactive", () => {
      const result = applyBindEvent(mockProfile, { active: false }, { kind: "key", code: "KeyX", at: 200 });
      expect(result).toBeNull();
    });

    it("should return null if event timestamp is older than startedAt", () => {
      const result = applyBindEvent(
        mockProfile,
        { active: true, plan: { kind: "digital", path: "face.primary" }, step: 0, startedAt: 200 },
        { kind: "key", code: "KeyX", at: 100 }
      );
      expect(result).toBeNull();
    });

    it("should cancel active binding and deactivate state on Escape key", () => {
      const result = applyBindEvent(
        mockProfile,
        { active: true, plan: { kind: "digital", path: "face.primary" }, step: 0, startedAt: 100 },
        { kind: "key", code: "Escape", at: 200 }
      );
      expect(result).toEqual({
        profile: mockProfile,
        state: { active: false }
      });
    });

    it("should bind digital key on standard digital plan", () => {
      const result = applyBindEvent(
        mockProfile,
        { active: true, plan: { kind: "digital", path: "face.primary" }, step: 0, startedAt: 100 },
        { kind: "key", code: "KeyX", at: 200 }
      );

      expect(result).toBeDefined();
      expect(result?.state).toEqual({ active: false });
      expect(result?.profile.player1.face.primary).toEqual({ type: "key", code: "KeyX" });
    });

    it("should handle multi-step dpad binding sequence", () => {
      const state1 = { active: true as const, plan: { kind: "dpad" as const, group: "dpad" as const }, step: 0, startedAt: 100 };
      
      // Step 0: Up
      const res1 = applyBindEvent(mockProfile, state1, { kind: "key", code: "ArrowUp", at: 200 });
      expect(res1?.state).toEqual({ ...state1, step: 1 });
      expect(res1?.profile.player1.dpad.up).toEqual({ type: "key", code: "ArrowUp" });

      // Step 1: Down
      if (!res1) throw new Error("Expected res1 to be defined");
      const res2 = applyBindEvent(res1.profile, res1.state, { kind: "key", code: "ArrowDown", at: 300 });
      expect(res2?.state).toEqual({ ...state1, step: 2 });
      expect(res2?.profile.player1.dpad.down).toEqual({ type: "key", code: "ArrowDown" });

      // Step 2: Left
      if (!res2) throw new Error("Expected res2 to be defined");
      const res3 = applyBindEvent(res2.profile, res2.state, { kind: "key", code: "ArrowLeft", at: 400 });
      expect(res3?.state).toEqual({ ...state1, step: 3 });
      expect(res3?.profile.player1.dpad.left).toEqual({ type: "key", code: "ArrowLeft" });

      // Step 3: Right (completes binding)
      if (!res3) throw new Error("Expected res3 to be defined");
      const res4 = applyBindEvent(res3.profile, res3.state, { kind: "key", code: "ArrowRight", at: 500 });
      expect(res4?.state).toEqual({ active: false });
      expect(res4?.profile.player1.dpad.right).toEqual({ type: "key", code: "ArrowRight" });
    });

    it("should handle stick binding sequence", () => {
      const state1 = { active: true as const, plan: { kind: "stick" as const, group: "move" as const, stick: "left" as const }, step: 0, startedAt: 100 };

      // Step 0: X axis
      const res1 = applyBindEvent(mockProfile, state1, { kind: "gp_axis", stick: "left", axis: "x", value: 1.0, at: 200 });
      expect(res1?.state).toEqual({ ...state1, step: 1 });
      
      // Step 1: Y axis (completes binding)
      if (!res1) throw new Error("Expected res1 to be defined");
      const res2 = applyBindEvent(res1.profile, res1.state, { kind: "gp_axis", stick: "left", axis: "y", value: 1.0, at: 300 });
      expect(res2?.state).toEqual({ active: false });
      expect(res2?.profile.player1.move).toEqual({
        type: "stick",
        stick: "left",
        deadzone: 0.15
      });
    });

    it("should ignore non-matching stick axis inputs during stick binding", () => {
      const state1 = { active: true as const, plan: { kind: "stick" as const, group: "move" as const, stick: "left" as const }, step: 0, startedAt: 100 };

      // Try binding Y axis when expecting X axis
      const res = applyBindEvent(mockProfile, state1, { kind: "gp_axis", stick: "left", axis: "y", value: 1.0, at: 200 });
      expect(res).toBeNull();
    });
  });
});
