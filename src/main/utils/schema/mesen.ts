import type { ConsoleID } from "../../../shared/types";

export const BASE_GAMEPAD = 0x1000;

/**  _keyCodeMap[128] from Mesen2 MacOSKeyManager.h */
export const MESEN_KEYCODE_MAP_128: number[] = [
  44, 62, 47, 49, 51, 50, 69, 67, 46, 65,
  154, 45, 60, 66, 48, 61, 68, 63, 35, 36,
  37, 38, 40, 39, 141, 43, 41, 143, 42, 34,
  151, 58, 64, 149, 52, 59, 6, 55, 53, 152,
  54, 140, 150, 142, 145, 57, 56, 144, 3, 18,
  146, 2, 6, 13, 71, 70, 116, 8, 120, 118,
  117, 121, 119, 0, 106, 88, 0, 84, 0, 85,
  0, 5, 131, 130, 129, 89, 6, 0, 87, 107,
  108, 141, 74, 75, 76, 77, 78, 79, 80, 81,
  109, 82, 83, 150, 154, 148, 94, 95, 96, 92,
  97, 98, 12, 100, 9, 102, 105, 103, 0, 99,
  72, 101, 0, 104, 31, 22, 19, 32, 93, 21,
  91, 20, 90, 23, 25, 26, 24, 0,
];

export const APPLE_KEYCODE_BY_CODE: Record<string, number> = Object.assign(Object.create(null), {
  KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyH: 4, KeyG: 5,
  KeyZ: 6, KeyX: 7, KeyC: 8, KeyV: 9, KeyB: 11, KeyQ: 12,
  KeyW: 13, KeyE: 14, KeyR: 15, KeyY: 16, KeyT: 17,
  KeyO: 31, KeyU: 32, KeyI: 34, KeyP: 35, KeyL: 37, KeyJ: 38,
  KeyK: 40, KeyN: 45, KeyM: 46,

  Digit1: 18, Digit2: 19, Digit3: 20, Digit4: 21, Digit5: 23,
  Digit6: 22, Digit7: 26, Digit8: 28, Digit9: 25, Digit0: 29,

  Space: 49,
  Enter: 36,
  Escape: 53,
  Tab: 48,
  Backspace: 51,

  ArrowLeft: 123,
  ArrowRight: 124,
  ArrowDown: 125,
  ArrowUp: 126,

  ShiftLeft: 56,
  ShiftRight: 60,
  ControlLeft: 59,
  ControlRight: 62,
  AltLeft: 58,
  AltRight: 61,

  // Punctuation
  Semicolon: 41,
  Equal: 24,
  Comma: 43,
  Minus: 27,
  Period: 47,
  Slash: 44,
  Backquote: 50,
  BracketLeft: 33,
  Backslash: 42,
  BracketRight: 30,
  Quote: 39,

  // Function Keys F1-F12
  F1: 122, F2: 120, F3: 99, F4: 118, F5: 96, F6: 97,
  F7: 98, F8: 100, F9: 101, F10: 109, F11: 103, F12: 111,

  // Numpad
  Numpad0: 82, Numpad1: 83, Numpad2: 84, Numpad3: 85, Numpad4: 86,
  Numpad5: 87, Numpad6: 88, Numpad7: 89, Numpad8: 91, Numpad9: 92,
  NumLock: 71, NumpadDivide: 75, NumpadMultiply: 67, NumpadSubtract: 78,
  NumpadAdd: 69, NumpadDecimal: 65, NumpadEnter: 76, NumpadEqual: 81,
});

export const MESEN_BUCKET_BY_CONSOLE: Partial<Record<ConsoleID, string>> = {
  nes: "Nes",
  snes: "Snes",
  gb: "Gameboy",
  gba: "Gba",
  pce: "PcEngine",
  sms: "Sms",
  gg: "Sms",
};

export const MESEN_PORT_TYPE_BY_CONSOLE: Partial<Record<ConsoleID, string>> = {
  nes: "NesController",
  snes: "SnesController",
  gb: "GameboyController",
  gba: "GbaController",
  sms: "SmsController",
  gg: "SmsController",
  pce: "PceController",
};

export function getMesenBucket(consoleId: ConsoleID): string | null {
  return MESEN_BUCKET_BY_CONSOLE[consoleId] ?? null;
}

export function getMesenControllerType(consoleId: ConsoleID, controllerId?: string): string | null {
  if (consoleId === 'nes') {
    if (controllerId === 'zapper') return "NesZapper";
    if (controllerId === 'power_pad') return "PowerPadSideA";
    if (controllerId === 'power_pad_b') return "PowerPadSideB";
    if (controllerId === 'arkanoid') return "NesArkanoidController";
    return "NesController";
  }
  if (consoleId === 'snes') {
    if (controllerId === 'mouse') return "SnesMouse";
    if (controllerId === 'super_scope' || controllerId === 'superscope') return "SuperScope";
    if (controllerId === 'rumble') return "SnesRumbleController";
    return "SnesController";
  }
  if (consoleId === 'pce') {
    if (controllerId === 'pad6') return "PceAvenuePad6";
    return "PceController";
  }
  return MESEN_PORT_TYPE_BY_CONSOLE[consoleId] ?? null;
}

export function getMesenKeyboardCode(domCode: string, platform: import("../../../shared/types").Platform = "darwin"): number | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { KeycodeMapper } = require("../keycodes/KeycodeMapper");
  const val = KeycodeMapper.toKeycode("mesen", domCode, platform);
  return typeof val === "number" ? val : null;
}