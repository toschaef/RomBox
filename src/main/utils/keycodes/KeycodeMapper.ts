import type { Platform } from "../../../shared/types";
import { APPLE_KEYCODE_BY_CODE, MESEN_KEYCODE_MAP_128 } from "../../emulators/mesen/schema";
import { resolveQuartzKeyboardKeyIndex, resolveRawinputKeyboardKeyIndex } from "../../emulators/ares/schema";
import { quartzKeyFromDomCode } from "../../emulators/dolphin/schema";
import { duckstationKeyFromDomCode } from "../../emulators/duckstation/schema";
import { osHandler } from "../../platform";

export type EngineId = "mesen" | "ares" | "dolphin" | "duckstation" | string;

export class KeycodeMapper {
    private static readonly RESOLVERS: Record<
    string,
    (domCode: string, platform: Platform) => number | string | null
  > = {
    mesen: (domCode, platform) => KeycodeMapper.toMesenKeycode(domCode, platform),
    ares: (domCode, platform) => KeycodeMapper.toAresKeycode(domCode, platform),
    dolphin: (domCode, platform) => KeycodeMapper.toDolphinKeycode(domCode, platform),
    duckstation: (domCode, platform) => KeycodeMapper.toDuckStationKeycode(domCode, platform),
  };

  /**
   * resolves a dom key code to the engine and platform specific keycode/key string
   */
  static toKeycode(
    engine: EngineId,
    domCode: string,
    platform: Platform = osHandler.getPlatform()
  ): number | string | null {
    const resolve = KeycodeMapper.RESOLVERS[engine.toLowerCase()];
    return resolve ? resolve(domCode, platform) : null;
  }

  static resolve(
    engine: EngineId,
    domCode: string,
    platform: Platform = osHandler.getPlatform()
  ): number | string | null {
    return this.toKeycode(engine, domCode, platform);
  }

  public toKeycode(
    engine: EngineId,
    domCode: string,
    platform: Platform = osHandler.getPlatform()
  ): number | string | null {
    return KeycodeMapper.toKeycode(engine, domCode, platform);
  }

  public resolve(
    engine: EngineId,
    domCode: string,
    platform: Platform = osHandler.getPlatform()
  ): number | string | null {
    return KeycodeMapper.toKeycode(engine, domCode, platform);
  }

  private static toMesenKeycode(domCode: string, platform: Platform): number | null {
    if (platform === "win32") {
      return this.toMesenWin32VK(domCode);
    }

    const apple = APPLE_KEYCODE_BY_CODE[domCode];
    if (apple === undefined || apple < 0 || apple >= MESEN_KEYCODE_MAP_128.length) return null;
    const mapped = MESEN_KEYCODE_MAP_128[apple] ?? 0;
    return mapped === 0 ? null : mapped;
  }

  private static toMesenWin32VK(domCode: string): number | null {
    if (domCode.startsWith("Key") && domCode.length === 4) {
      const letterIndex = domCode.charCodeAt(3) - "A".charCodeAt(0);
      if (letterIndex < 0 || letterIndex > 25) return null;
      return 44 + letterIndex;
    }
    if (domCode.startsWith("Digit") && domCode.length === 6) {
      const digit = domCode.charCodeAt(5) - "0".charCodeAt(0);
      if (digit < 0 || digit > 9) return null;
      return 34 + digit;
    }
    if (/^F([1-9]|1[0-2])$/.test(domCode)) {
      const num = parseInt(domCode.slice(1), 10);
      return 89 + num;
    }
    if (/^Numpad[0-9]$/.test(domCode)) {
      const num = parseInt(domCode[6], 10);
      return 74 + num;
    }

    return MESEN_WIN32_VK_MAP[domCode] ?? null;
  }

  private static toAresKeycode(domCode: string, platform: Platform): number | null {
    if (platform === "win32") {
      return resolveRawinputKeyboardKeyIndex(domCode);
    }
    return resolveQuartzKeyboardKeyIndex(domCode);
  }

  private static toDolphinKeycode(domCode: string, platform: Platform): string | null {
    if (platform === "win32") {
      return this.toDolphinWin32Key(domCode);
    }
    // Default darwin (macOS)
    return quartzKeyFromDomCode(domCode);
  }

  private static toDolphinWin32Key(domCode: string): string | null {
    if (domCode.startsWith("Key") && domCode.length === 4) {
      return domCode[3].toUpperCase();
    }
    if (domCode.startsWith("Digit") && domCode.length === 6) {
      return domCode[5];
    }
    if (/^F([1-9]|1[0-2])$/.test(domCode)) {
      return domCode;
    }
    if (/^Numpad[0-9]$/.test(domCode)) {
      return `NUMPAD${domCode[6]}`;
    }

    return DOLPHIN_WIN32_KEY_MAP[domCode] ?? quartzKeyFromDomCode(domCode);
  }

  private static toDuckStationKeycode(domCode: string, _platform: Platform): string | null {
    return duckstationKeyFromDomCode(domCode);
  }
}

const MESEN_WIN32_VK_MAP: Record<string, number> = Object.assign(Object.create(null), {
  Space: 18,
  Enter: 6,
  NumpadEnter: 6,
  Escape: 13,
  Tab: 3,
  Backspace: 2,
  ArrowLeft: 23,
  ArrowUp: 24,
  ArrowRight: 25,
  ArrowDown: 26,
  Insert: 31,
  Delete: 32,
  Home: 22,
  End: 21,
  PageUp: 19,
  PageDown: 20,
  CapsLock: 8,
  NumLock: 114,
  ScrollLock: 115,
  Pause: 7,
  ShiftLeft: 116,
  ShiftRight: 117,
  ControlLeft: 118,
  ControlRight: 119,
  AltLeft: 120,
  AltRight: 121,
  MetaLeft: 70,
  MetaRight: 71,
  ContextMenu: 72,
  Semicolon: 140,
  Equal: 141,
  Comma: 142,
  Minus: 143,
  Period: 144,
  Slash: 145,
  Backquote: 146,
  BracketLeft: 149,
  Backslash: 150,
  BracketRight: 151,
  Quote: 152,
  NumpadMultiply: 84,
  NumpadAdd: 85,
  NumpadSubtract: 87,
  NumpadDecimal: 88,
  NumpadDivide: 89,
});

const DOLPHIN_WIN32_KEY_MAP: Record<string, string> = Object.assign(Object.create(null), {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  Enter: "RETURN",
  NumpadEnter: "RETURN",
  Space: "SPACE",
  Escape: "ESCAPE",
  Tab: "TAB",
  Backspace: "BACK",
  ShiftLeft: "LSHIFT",
  ShiftRight: "RSHIFT",
  ControlLeft: "LCONTROL",
  ControlRight: "RCONTROL",
  AltLeft: "LMENU",
  AltRight: "RMENU",
  Semicolon: "SEMICOLON",
  Equal: "EQUALS",
  Comma: "COMMA",
  Minus: "MINUS",
  Period: "PERIOD",
  Slash: "SLASH",
  Backquote: "GRAVE",
  BracketLeft: "LBRACKET",
  Backslash: "BACKSLASH",
  BracketRight: "RBRACKET",
  Quote: "APOSTROPHE",
  NumpadMultiply: "MULTIPLY",
  NumpadAdd: "ADD",
  NumpadSubtract: "SUBTRACT",
  NumpadDecimal: "DECIMAL",
  NumpadDivide: "DIVIDE",
});

export const keycodeMapper = new KeycodeMapper();
