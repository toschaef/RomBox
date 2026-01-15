import path from "path";
import type { GamepadToken } from "../../../shared/controls/gamepadTokens";


export const PCSX2 = {
  PAD_PROFILE_NAME: "RomBox_P1",

  getConfigDir(platform: "win32" | "darwin" | "linux", homeDir: string): string {
    switch (platform) {
      case "win32":
        return path.join(homeDir, "Documents", "PCSX2");
      case "darwin":
        return path.join(homeDir, "Library", "Application Support", "PCSX2");
      case "linux":
        return path.join(homeDir, ".config", "PCSX2");
      default:
        return path.join(homeDir, ".config", "PCSX2");
    }
  },

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

export function pcsx2ExprForGamepadToken(tok: GamepadToken): string | null {
  switch (tok) {
    case "GP_A": return "SDL-0/FaceSouth";
    case "GP_B": return "SDL-0/FaceEast";
    case "GP_X": return "SDL-0/FaceWest";
    case "GP_Y": return "SDL-0/FaceNorth";
    case "GP_L1": return "SDL-0/LeftShoulder";
    case "GP_R1": return "SDL-0/RightShoulder";
    case "GP_L2": return "SDL-0/+LeftTrigger";
    case "GP_R2": return "SDL-0/+RightTrigger";
    case "GP_SELECT": return "SDL-0/Back";
    case "GP_START": return "SDL-0/Start";
    case "GP_L3": return "SDL-0/LeftStick";
    case "GP_R3": return "SDL-0/RightStick";
    case "GP_DPAD_UP": return "SDL-0/DPadUp";
    case "GP_DPAD_DOWN": return "SDL-0/DPadDown";
    case "GP_DPAD_LEFT": return "SDL-0/DPadLeft";
    case "GP_DPAD_RIGHT": return "SDL-0/DPadRight";
    case "GP_LS_LEFT": return "SDL-0/-LeftX";
    case "GP_LS_RIGHT": return "SDL-0/+LeftX";
    // Y axis is swapped to compensate for getDirFromMove
    case "GP_LS_UP": return "SDL-0/+LeftY";
    case "GP_LS_DOWN": return "SDL-0/-LeftY";
    case "GP_RS_LEFT": return "SDL-0/-RightX";
    case "GP_RS_RIGHT": return "SDL-0/+RightX";
    case "GP_RS_UP": return "SDL-0/-RightY";
    case "GP_RS_DOWN": return "SDL-0/+RightY";
  }
  return null;
}
