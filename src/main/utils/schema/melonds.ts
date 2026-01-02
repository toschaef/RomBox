import type { GamepadToken } from "../../../shared/controls/gamepadTokens";

export const MELONDS = {
  ROOT: "" as const,
  KB_TABLE: "Instance0.Keyboard" as const,
  JOY_TABLE: "Instance0.Joystick" as const,
  INSTANCE: "Instance0" as const,
};

const TOKEN_TO_JOY_CODE: Partial<Record<GamepadToken, number>> = {
  GP_B: 0,
  GP_A: 1,
  GP_Y: 2,
  GP_X: 3,

  GP_SELECT: 4,
  GP_START: 6,

  GP_L1: 9,
  GP_R1: 10,

  GP_DPAD_UP: 11,
  GP_DPAD_DOWN: 12,
  GP_DPAD_LEFT: 13,
  GP_DPAD_RIGHT: 14,
};

function encodeAxis(axisIndex: number, sign: "pos" | "neg"): number {
  const signByte = sign === "pos" ? 0x01 : 0x11;
  return (axisIndex << 24) | (signByte << 16);
}

export function melondsJoyCodeForToken(token: GamepadToken): number {
  switch (token) {
    case "GP_LS_RIGHT": return encodeAxis(0, "pos");
    case "GP_LS_LEFT":  return encodeAxis(0, "neg");
    case "GP_LS_DOWN":  return encodeAxis(1, "pos");
    case "GP_LS_UP":    return encodeAxis(1, "neg");

    case "GP_RS_RIGHT": return encodeAxis(2, "pos");
    case "GP_RS_LEFT":  return encodeAxis(2, "neg");
    case "GP_RS_DOWN":  return encodeAxis(3, "pos");
    case "GP_RS_UP":    return encodeAxis(3, "neg");
  }

  return TOKEN_TO_JOY_CODE[token] ?? -1;
}