import {
  dpadDirBinding,
  getDpadLike,
  digitalToGamepadToken,
  getDirFromMove,
  getStickDirFromMove,
  getDirUnion,
  getDirFromLook,
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

  describe("getDpadLike", () => {
    it("should query move dpad binding first", () => {
      mockProfile.player1.move = {
        type: "dpad",
        up: { type: "key", code: "KeyW" }
      };
      expect(getDpadLike(mockProfile, "up")).toEqual({ type: "key", code: "KeyW" });
    });

    it("should query standard dpad binding if move is a stick or undefined", () => {
      mockProfile.player1.move = {
        type: "stick",
        stick: "left",
        deadzone: 0.15
      };
      mockProfile.player1.dpad = {
        type: "dpad",
        down: { type: "key", code: "KeyS" }
      };
      expect(getDpadLike(mockProfile, "down")).toEqual({ type: "key", code: "KeyS" });
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

      // invertY inverts up (normal: pos due to swap) to neg
      expect((getDirFromMove(mockProfile, "up") as unknown as { dir?: string })?.dir).toBe("neg");
      expect((getDirFromMove(mockProfile, "down") as unknown as { dir?: string })?.dir).toBe("pos");
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
});
