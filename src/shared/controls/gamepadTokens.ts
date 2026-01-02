export type GamepadToken = keyof typeof GP_FIXED_TO_INDEX;

export const GP_FIXED_TO_INDEX = {
  GP_A: 0,
  GP_B: 1,
  GP_X: 2,
  GP_Y: 3,

  GP_L1: 4,
  GP_R1: 5,

  GP_SELECT: 7,
  GP_START: 6,

  GP_L2: 12,
  GP_R2: 13,

  GP_L3: 14,
  GP_R3: 15,

  GP_DPAD_UP: 8,
  GP_DPAD_DOWN: 9,
  GP_DPAD_LEFT: 10,
  GP_DPAD_RIGHT: 11,

  GP_LX_POS: 16,
  GP_LX_NEG: 17,
  GP_LY_POS: 18,
  GP_LY_NEG: 19,

  GP_RX_POS: 20,
  GP_RX_NEG: 21,
  GP_RY_POS: 22,
  GP_RY_NEG: 23,

  GP_LS_RIGHT: 16,
  GP_LS_LEFT: 17,
  GP_LS_DOWN: 18,
  GP_LS_UP: 19,

  GP_RS_RIGHT: 20,
  GP_RS_LEFT: 21,
  GP_RS_DOWN: 22,
  GP_RS_UP: 23,
} as const;

export function isGamepadToken(x: string): x is GamepadToken {
  return x in GP_FIXED_TO_INDEX;
}

export type AxisDigital = {
  stick: "left" | "right";
  axis: "x" | "y";
  sign: 1 | -1;
};

export function axisToDigitalToken(b: AxisDigital): GamepadToken {
  const stick = b.stick === "left" ? "LS" : "RS";
  if (b.axis === "x") return (`GP_${stick}_${b.sign === -1 ? "LEFT" : "RIGHT"}`) as GamepadToken;
  return (`GP_${stick}_${b.sign === -1 ? "UP" : "DOWN"}`) as GamepadToken;
}