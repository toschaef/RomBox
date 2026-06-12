import type { GamepadToken } from "./gamepadTokens";

export const AXIS_THRESHOLD = 0.65;

export type InputEvent =
  | { kind: "key"; code: string; at: number }
  | { kind: "gp_button"; token: GamepadToken; at: number }
  | { kind: "gp_axis"; stick: "left" | "right"; axis: "x" | "y"; value: number; at: number };
