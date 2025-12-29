import type { ActionBindings, PhysicalBinding, LogicalAction } from "../../../shared/types/controls";
import {
  BASE_GAMEPAD,
  MESEN_ACTION_MAP,
  GP_FIXED_TO_INDEX,
  MESEN_KEYCODE_MAP_128,
  APPLE_KEYCODE_BY_CODE,
} from "../schema/mesen";

type Device = "keyboard" | "gamepad";

function mesenKeyboardCode(code: string): number | null {
  const apple = APPLE_KEYCODE_BY_CODE[code];
  if (apple === undefined || apple < 0 || apple >= 128) return null;
  const mapped = MESEN_KEYCODE_MAP_128[apple] ?? 0;
  return mapped === 0 ? null : mapped;
}

function mesenGamepadCode(token: string, port1Based: number): number | null {
  const idx = GP_FIXED_TO_INDEX[token];
  if (idx === undefined) return null;
  const p = Math.max(1, port1Based) - 1;
  return BASE_GAMEPAD + p * 0x100 + idx;
}

function translateOne(b: PhysicalBinding, player: number): number | null {
  if (b.device === "keyboard") return mesenKeyboardCode(b.input);
  return mesenGamepadCode(b.input, player);
}

function firstNumber(list: PhysicalBinding[], player: number): number | null {
  for (const b of list) {
    const v = translateOne(b, player);
    if (v !== null) return v;
  }
  return null;
}

export class MesenTranslator {
  translate(bindings: ActionBindings, player = 1): Record<string, number> {
    return this.translateForDevice(bindings, player, null);
  }

  translateForDevice(
    bindings: ActionBindings,
    player = 1,
    device: Device | null
  ): Record<string, number> {
    const mapping: Record<string, number> = {};

    for (const [action, list] of Object.entries(bindings) as [LogicalAction, PhysicalBinding[]][]) {
      const mesenName = MESEN_ACTION_MAP[action];
      if (!mesenName) continue;

      const filtered = device ? list.filter(b => b.device === device) : list;
      if (filtered.length === 0) continue;

      const n = firstNumber(filtered, player);
      if (n !== null) mapping[mesenName] = n;
    }

    return mapping;
  }
}
