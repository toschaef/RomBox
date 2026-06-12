import {
  dpadDirBinding,
  digitalToGamepadToken,
  getDirFromMove,
  getStickDirFromMove,
  getDirUnion,
  getDirFromLook,
  pickDir,
  getDirFromBinding,
} from "../../src/main/utils/profileRead";
import type { ControlsProfile } from "../../src/shared/types/controls";
import { createDefaultProfileShape } from "../../src/shared/controls/layoutDefaults";

describe("profileRead", () => {
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

  describe("dpadDirBinding", () => {
    it("should extract exact dpad direction binding", () => {
      const dpad = { type: "dpad" as const, up: { type: "key" as const, code: "KeyW" } };
      expect(dpadDirBinding(dpad, "up")).toEqual({ type: "key", code: "KeyW" });
      expect(dpadDirBinding(dpad, "down")).toBeUndefined();
    });
  });



  describe("digitalToGamepadToken", () => {
    it("should return gp_button token directly", () => {
      expect(digitalToGamepadToken({ type: "gp_button", token: "GP_A" })).toBe("GP_A");
    });

    it("should map gp_axis_digital to correct GP axis token", () => {
      expect(digitalToGamepadToken({
        type: "gp_axis_digital",
        stick: "left",
        axis: "x",
        dir: "neg",
        threshold: 0.65
      })).toBe("GP_LS_LEFT");
    });

    it("should return null for key bindings", () => {
      expect(digitalToGamepadToken({ type: "key", code: "KeyW" })).toBeNull();
    });
  });

  describe("getDirFromMove", () => {
    it("should resolve direct dpad directions if move is dpad", () => {
      mockProfile.player1.move = {
        type: "dpad",
        left: { type: "key", code: "KeyA" }
      };
      expect(getDirFromMove(mockProfile, "left")).toEqual({ type: "key", code: "KeyA" });
    });

    it("should synthesize digital axis bindings if move is stick", () => {
      mockProfile.player1.move = {
        type: "stick",
        stick: "left",
        deadzone: 0.15
      };
      const binding = getDirFromMove(mockProfile, "left");
      expect(binding).toEqual({
        type: "gp_axis_digital",
        stick: "left",
        axis: "x",
        dir: "neg",
        threshold: 0.65
      });
    });

    it("should respect invertX and invertY stick settings", () => {
      mockProfile.player1.move = {
        type: "stick",
        stick: "left",
        deadzone: 0.15,
        invertX: true,
        invertY: true
      };
      // invertX inverts left (normal: neg) to pos
      expect((getDirFromMove(mockProfile, "left") as unknown as { dir?: string })?.dir).toBe("pos");
      expect((getDirFromMove(mockProfile, "right") as unknown as { dir?: string })?.dir).toBe("neg");

      // invertY inverts up (normal: neg) to pos
      expect((getDirFromMove(mockProfile, "up") as unknown as { dir?: string })?.dir).toBe("pos");
      expect((getDirFromMove(mockProfile, "down") as unknown as { dir?: string })?.dir).toBe("neg");
    });
  });

  describe("getStickDirFromMove", () => {
    it("should return undefined if move is dpad", () => {
      mockProfile.player1.move = { type: "dpad" };
      expect(getStickDirFromMove(mockProfile, "up")).toBeUndefined();
    });
  });

  describe("getDirUnion", () => {
    it("should return union of dpad and move bindings", () => {
      mockProfile.player1.dpad = { type: "dpad", up: { type: "key", code: "KeyUp" } };
      mockProfile.player1.move = { type: "dpad", down: { type: "key", code: "KeyDown" } };

      expect(getDirUnion(mockProfile, "up")).toEqual({ type: "key", code: "KeyUp" });
      expect(getDirUnion(mockProfile, "down")).toEqual({ type: "key", code: "KeyDown" });
    });
  });

  describe("getDirFromLook", () => {
    it("should return stick mapping for look stick", () => {
      mockProfile.player1.look = {
        type: "stick",
        stick: "right",
        deadzone: 0.15
      };
      expect(getDirFromLook(mockProfile, "up")).toEqual({
        type: "gp_axis_digital",
        stick: "right",
        axis: "y",
        dir: "neg",
        threshold: 0.65
      });
    });
  });

  describe("pickDir", () => {
    it("should return the correct binding for each direction", () => {
      const dpad = {
        type: "dpad" as const,
        up: { type: "key" as const, code: "ArrowUp" },
        down: { type: "key" as const, code: "ArrowDown" },
        left: { type: "key" as const, code: "ArrowLeft" },
        right: { type: "key" as const, code: "ArrowRight" },
      };
      expect(pickDir(dpad, "up")).toEqual({ type: "key", code: "ArrowUp" });
      expect(pickDir(dpad, "down")).toEqual({ type: "key", code: "ArrowDown" });
      expect(pickDir(dpad, "left")).toEqual({ type: "key", code: "ArrowLeft" });
      expect(pickDir(dpad, "right")).toEqual({ type: "key", code: "ArrowRight" });
    });
  });

  describe("getDirFromBinding", () => {
    it("should return undefined if binding is undefined", () => {
      expect(getDirFromBinding(undefined, "up")).toBeUndefined();
    });

    it("should resolve dpad direction from dpad binding", () => {
      const binding = {
        type: "dpad" as const,
        up: { type: "key" as const, code: "KeyW" },
      };
      expect(getDirFromBinding(binding, "up")).toEqual({ type: "key", code: "KeyW" });
      expect(getDirFromBinding(binding, "down")).toBeUndefined();
    });

    it("should synthesize digital axis bindings from stick binding", () => {
      const binding = {
        type: "stick" as const,
        stick: "left" as const,
        deadzone: 0.15,
      };
      expect(getDirFromBinding(binding, "left")).toEqual({
        type: "gp_axis_digital",
        stick: "left",
        axis: "x",
        dir: "neg",
        threshold: 0.65,
      });
      expect(getDirFromBinding(binding, "up")).toEqual({
        type: "gp_axis_digital",
        stick: "left",
        axis: "y",
        dir: "neg",
        threshold: 0.65,
      });
    });
  });
});
