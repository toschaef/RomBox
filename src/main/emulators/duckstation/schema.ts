import path from "path";
import type { GamepadToken } from "../../../shared/controls/gamepadTokens";
import type { TranslateContext } from "../translatorTypes";
import type { ControlsProfile } from "../../../shared/types/controls";

export const DuckStation = {
  iniPath(configDir: string): string {
    return path.join(configDir, "settings.ini");
  },
};

export function parseSDLDeviceIndex(str?: string | null): number | null {
  if (!str) return null;
  const match = str.match(/(?:SDL[-/]|^\s*)(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  const fallbackMatch = str.match(/\d+/);
  if (fallbackMatch) {
    return parseInt(fallbackMatch[0], 10);
  }
  return null;
}

export function getSDLDeviceIndex(ctx?: Partial<TranslateContext>, profile?: ControlsProfile): number {
  if (ctx?.learnedDevice) {
    const idx = parseSDLDeviceIndex(ctx.learnedDevice);
    if (idx !== null) return idx;
  }
  if (ctx?.deviceIndex !== undefined) {
    return ctx.deviceIndex;
  }
  if (profile?.preferredControllerId) {
    const idx = parseSDLDeviceIndex(profile.preferredControllerId);
    if (idx !== null) return idx;
  }
  if (ctx?.padPort !== undefined) {
    return ctx.padPort > 0 ? ctx.padPort - 1 : ctx.padPort;
  }
  return 0;
}

const DUCKSTATION_MAP: Record<string, string> = Object.assign(Object.create(null), {
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
  ShiftLeft: "LeftShift",
  ShiftRight: "RightShift",
  ControlLeft: "LeftControl",
  ControlRight: "RightControl",
  AltLeft: "LeftAlt",
  AltRight: "LeftAlt",
  // Punctuation
  Comma: ",",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  Slash: "/",
  Backslash: "\\",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backquote: "`",
  // Numpad
  Numpad0: "Numpad0",
  Numpad1: "Numpad1",
  Numpad2: "Numpad2",
  Numpad3: "Numpad3",
  Numpad4: "Numpad4",
  Numpad5: "Numpad5",
  Numpad6: "Numpad6",
  Numpad7: "Numpad7",
  Numpad8: "Numpad8",
  Numpad9: "Numpad9",
  NumpadDivide: "Numpad/",
  NumpadMultiply: "Numpad*",
  NumpadSubtract: "Numpad-",
  NumpadAdd: "Numpad+",
  NumpadDecimal: "Numpad.",
});

export function duckstationKeyFromDomCode(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;

  return DUCKSTATION_MAP[code] ?? null;
}

export function duckstationExprForGamepadToken(tok: GamepadToken, deviceIndex = 0): string | null {
  const prefix = `SDL-${deviceIndex}/`;
  switch (tok) {
    case "GP_A": return `${prefix}A`;
    case "GP_B": return `${prefix}B`;
    case "GP_X": return `${prefix}X`;
    case "GP_Y": return `${prefix}Y`;
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

