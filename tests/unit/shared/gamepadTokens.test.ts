import { isGamepadToken, axisToDigitalToken } from "../../../src/shared/controls/gamepadTokens";

describe("gamepadTokens", () => {
  describe("isGamepadToken", () => {
    it("should return true for valid gamepad tokens", () => {
      expect(isGamepadToken("GP_A")).toBe(true);
      expect(isGamepadToken("GP_B")).toBe(true);
      expect(isGamepadToken("GP_START")).toBe(true);
      expect(isGamepadToken("GP_DPAD_UP")).toBe(true);
      expect(isGamepadToken("GP_LX_POS")).toBe(true);
    });

    it("should return false for invalid strings", () => {
      expect(isGamepadToken("INVALID")).toBe(false);
      expect(isGamepadToken("")).toBe(false);
      expect(isGamepadToken("GP_A_INVALID")).toBe(false);
    });
  });

  describe("axisToDigitalToken", () => {
    it("should return correct token for left stick X axis", () => {
      expect(axisToDigitalToken({ stick: "left", axis: "x", sign: 1 })).toBe("GP_LS_RIGHT");
      expect(axisToDigitalToken({ stick: "left", axis: "x", sign: -1 })).toBe("GP_LS_LEFT");
    });

    it("should return correct token for left stick Y axis", () => {
      expect(axisToDigitalToken({ stick: "left", axis: "y", sign: 1 })).toBe("GP_LS_DOWN");
      expect(axisToDigitalToken({ stick: "left", axis: "y", sign: -1 })).toBe("GP_LS_UP");
    });

    it("should return correct token for right stick X axis", () => {
      expect(axisToDigitalToken({ stick: "right", axis: "x", sign: 1 })).toBe("GP_RS_RIGHT");
      expect(axisToDigitalToken({ stick: "right", axis: "x", sign: -1 })).toBe("GP_RS_LEFT");
    });

    it("should return correct token for right stick Y axis", () => {
      expect(axisToDigitalToken({ stick: "right", axis: "y", sign: 1 })).toBe("GP_RS_DOWN");
      expect(axisToDigitalToken({ stick: "right", axis: "y", sign: -1 })).toBe("GP_RS_UP");
    });
  });
});
