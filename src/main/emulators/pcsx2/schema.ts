import path from "path";
import type { GamepadToken } from "../../../shared/controls/gamepadTokens";
// PCSX2 and DuckStation share SDL's device-index convention.
import { parseSDLDeviceIndex, getSDLDeviceIndex } from "../duckstation/schema";

export { parseSDLDeviceIndex, getSDLDeviceIndex };

export const PCSX2 = {
  PAD_PROFILE_NAME: "RomBox_P1",

  iniPath(configDir: string): string {
    return path.join(configDir, "inis", "PCSX2.ini");
  },

  padPath(configDir: string): string {
    return path.join(configDir, "inis", "PAD.ini");
  },
};

export function pcsx2KeyFromDomCode(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);

  const map: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Enter: "Return",
    NumpadEnter: "Return",
    Space: "Space",
    Escape: "Escape",
    Tab: "Tab",
    Backspace: "Backspace",
    ShiftLeft: "LShift",
    ShiftRight: "RShift",
    ControlLeft: "LCtrl",
    ControlRight: "RCtrl",
    AltLeft: "LAlt",
    AltRight: "RAlt",
  };

  return map[code] ?? null;
}

export function pcsx2ExprForGamepadToken(tok: GamepadToken, deviceIndex = 0): string | null {
  const prefix = `SDL-${deviceIndex}/`;
  switch (tok) {
    case "GP_A": return `${prefix}FaceSouth`;
    case "GP_B": return `${prefix}FaceEast`;
    case "GP_X": return `${prefix}FaceWest`;
    case "GP_Y": return `${prefix}FaceNorth`;
    case "GP_L1": return `${prefix}LeftShoulder`;
    case "GP_R1": return `${prefix}RightShoulder`;
    case "GP_L2": return `${prefix}+LeftTrigger`;
    case "GP_R2": return `${prefix}+RightTrigger`;
    case "GP_SELECT": return `${prefix}Back`;
    case "GP_START": return `${prefix}Start`;
    case "GP_L3": return `${prefix}LeftStick`;
    case "GP_R3": return `${prefix}RightStick`;
    case "GP_DPAD_UP": return `${prefix}DPadUp`;
    case "GP_DPAD_DOWN": return `${prefix}DPadDown`;
    case "GP_DPAD_LEFT": return `${prefix}DPadLeft`;
    case "GP_DPAD_RIGHT": return `${prefix}DPadRight`;
    case "GP_LS_LEFT": return `${prefix}-LeftX`;
    case "GP_LS_RIGHT": return `${prefix}+LeftX`;
    case "GP_LS_UP": return `${prefix}-LeftY`;
    case "GP_LS_DOWN": return `${prefix}+LeftY`;
    case "GP_RS_LEFT": return `${prefix}-RightX`;
    case "GP_RS_RIGHT": return `${prefix}+RightX`;
    case "GP_RS_UP": return `${prefix}-RightY`;
    case "GP_RS_DOWN": return `${prefix}+RightY`;
  }
  return null;
}

