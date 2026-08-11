// melonds encodes stick directions as a packed axis code and everything else as
// a plain button index.
import {
  MELONDS,
  melondsJoyCodeForToken,
} from "../../../../../src/main/emulators/melonds/schema";
import type { GamepadToken } from "../../../../../src/shared/controls/gamepadTokens";

describe("melondsJoyCodeForToken", () => {
  describe("stick axes", () => {
    // packed as (axisIndex << 24) | (signByte << 16), sign 0x01 positive / 0x11 negative
    const pack = (axis: number, sign: "pos" | "neg") =>
      (axis << 24) | ((sign === "pos" ? 0x01 : 0x11) << 16);

    it.each([
      ["GP_LS_RIGHT", 0, "pos"],
      ["GP_LS_LEFT", 0, "neg"],
      ["GP_LS_DOWN", 1, "pos"],
      ["GP_LS_UP", 1, "neg"],
      ["GP_RS_RIGHT", 2, "pos"],
      ["GP_RS_LEFT", 2, "neg"],
      ["GP_RS_DOWN", 3, "pos"],
      ["GP_RS_UP", 3, "neg"],
    ] as Array<[GamepadToken, number, "pos" | "neg"]>)(
      "packs %s as axis %i %s",
      (token, axis, sign) => {
        expect(melondsJoyCodeForToken(token)).toBe(pack(axis, sign));
      }
    );

    it("gives each stick direction a distinct code", () => {
      const tokens: GamepadToken[] = [
        "GP_LS_UP", "GP_LS_DOWN", "GP_LS_LEFT", "GP_LS_RIGHT",
        "GP_RS_UP", "GP_RS_DOWN", "GP_RS_LEFT", "GP_RS_RIGHT",
      ];
      const codes = tokens.map(melondsJoyCodeForToken);
      expect(new Set(codes).size).toBe(tokens.length);
    });
  });

  describe("buttons", () => {
    it("maps face and shoulder buttons to their table index", () => {
      expect(melondsJoyCodeForToken("GP_A")).toBeGreaterThanOrEqual(0);
      expect(melondsJoyCodeForToken("GP_B")).toBeGreaterThanOrEqual(0);
      expect(melondsJoyCodeForToken("GP_L1")).toBeGreaterThanOrEqual(0);
      expect(melondsJoyCodeForToken("GP_R1")).toBeGreaterThanOrEqual(0);
    });

    it("maps the d-pad", () => {
      for (const t of ["GP_DPAD_UP", "GP_DPAD_DOWN", "GP_DPAD_LEFT", "GP_DPAD_RIGHT"] as GamepadToken[]) {
        expect(melondsJoyCodeForToken(t)).toBeGreaterThanOrEqual(0);
      }
    });

    it("gives each button a distinct code", () => {
      const tokens: GamepadToken[] = [
        "GP_A", "GP_B", "GP_X", "GP_Y", "GP_L1", "GP_R1",
        "GP_DPAD_UP", "GP_DPAD_DOWN", "GP_DPAD_LEFT", "GP_DPAD_RIGHT",
      ];
      const codes = tokens.map(melondsJoyCodeForToken);
      expect(new Set(codes).size).toBe(tokens.length);
    });

    it("returns -1 for a token it does not know", () => {
      expect(melondsJoyCodeForToken("GP_NOT_A_TOKEN" as GamepadToken)).toBe(-1);
    });
  });
});

describe("MELONDS schema constants", () => {
  it("names the instance section and both binding tables", () => {
    expect(MELONDS.INSTANCE).toBeTruthy();
    expect(MELONDS.KB_TABLE).toBeTruthy();
    expect(MELONDS.JOY_TABLE).toBeTruthy();
    expect(MELONDS.KB_TABLE).not.toBe(MELONDS.JOY_TABLE);
  });
});
