import path from "path";
import type { GamepadToken } from "../../../shared/controls/gamepadTokens";

export const DOLPHIN = {
  GC_PROFILE_NAME: "RomBox_P1",
  WII_PROFILE_NAME: "RomBox_Wii_P1",
  MAC_QUARTZ_DEVICE: "Quartz/0/Keyboard & Mouse",
  GCPAD_NEW_INI: "GCPadNew.ini",
  WIIMOTE_NEW_INI: "WiimoteNew.ini",

  gcPadNewPath(configDir: string) {
    return path.join(configDir, this.GCPAD_NEW_INI);
  },
  wiimoteNewPath(configDir: string) {
    return path.join(configDir, this.WIIMOTE_NEW_INI);
  },
};

export function quartzKeyFromDomCode(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);

  const map: Record<string, string> = {
    ArrowUp: "Up Arrow",
    ArrowDown: "Down Arrow",
    ArrowLeft: "Left Arrow",
    ArrowRight: "Right Arrow",
    Enter: "Return",
    NumpadEnter: "Return",
    Space: "Space",
    Escape: "Escape",
    Tab: "Tab",
    Backspace: "Backspace",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
    AltLeft: "Alt",
    AltRight: "Alt",
  };

  return map[code] ?? null;
}

export function dolphinExprForGamepadToken(tok: GamepadToken): string | null {
  switch (tok) {
    case "GP_A": return "`Button A`";
    case "GP_B": return "`Button B`";
    case "GP_X": return "`Button X`";
    case "GP_Y": return "`Button Y`";
    case "GP_L1": return "`Shoulder L`";
    case "GP_R1": return "`Shoulder R`";
    case "GP_L2": return "`Trigger L`";
    case "GP_R2": return "`Trigger R`";
    case "GP_START": return "`Start`";
    case "GP_SELECT": return "`Back`";
    case "GP_DPAD_UP": return "`Pad N`";
    case "GP_DPAD_DOWN": return "`Pad S`";
    case "GP_DPAD_LEFT": return "`Pad W`";
    case "GP_DPAD_RIGHT": return "`Pad E`";
    case "GP_LS_LEFT": return "`Left X-`";
    case "GP_LS_RIGHT": return "`Left X+`";
    case "GP_LS_UP": return "`Left Y+`";
    case "GP_LS_DOWN": return "`Left Y-`";
    case "GP_RS_LEFT": return "`Right X-`";
    case "GP_RS_RIGHT": return "`Right X+`";
    case "GP_RS_UP": return "`Right Y+`";
    case "GP_RS_DOWN": return "`Right Y-`";
  }
  return null;
}