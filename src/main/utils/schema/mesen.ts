import type { LogicalAction } from "../../../shared/types/controls";
import { ConsoleID } from "../../../shared/types";

export const BASE_GAMEPAD = 0x1000;

export const MESEN_ACTION_MAP: Record<LogicalAction, string> = {
  MOVE_UP: "Up",
  MOVE_DOWN: "Down",
  MOVE_LEFT: "Left",
  MOVE_RIGHT: "Right",
  FACE_PRIMARY: "A",
  FACE_SECONDARY: "B",
  FACE_TERTIARY: "X",
  FACE_QUATERNARY: "Y",
  BUMPER_L: "L",
  BUMPER_R: "R",
  TRIGGER_L: "L2",
  TRIGGER_R: "R2",
  START: "Start",
  SELECT: "Select",
};

export const GP_FIXED_TO_INDEX: Record<string, number> = {
  GP_DPAD_UP: 8,
  GP_DPAD_DOWN: 9,
  GP_DPAD_LEFT: 10,
  GP_DPAD_RIGHT: 11,

  GP_LS_RIGHT: 16,
  GP_LS_LEFT: 17,
  GP_LS_DOWN: 18,
  GP_LS_UP: 19,

  GP_RS_RIGHT: 20,
  GP_RS_LEFT: 21,
  GP_RS_DOWN: 22,
  GP_RS_UP: 23,

  GP_A: 0,
  GP_B: 1,
  GP_X: 2,
  GP_Y: 3,
  GP_L1: 4,
  GP_R1: 5,
  GP_START: 6,
  GP_SELECT: 7,
  GP_L2: 12,
  GP_R2: 13,
  GP_L3: 14,
  GP_R3: 15,
};

// _keyCodeMap[128] from Mesen2 MacOSKeyManager.h
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

// todo: do the rest of the keys
export const APPLE_KEYCODE_BY_CODE: Record<string, number> = {
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
};

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
  gb: "GbController",
  gba: "GbaController",
  sms: "SmsController",
  gg: "SmsController",
  pce: "PceController",
};

export function getMesenBucket(consoleId: ConsoleID): string | null {
  const b = MESEN_BUCKET_BY_CONSOLE[consoleId];
  return b ? b : null;
}
