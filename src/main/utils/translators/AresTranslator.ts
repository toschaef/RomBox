import type { PlayerBindings, DigitalBinding, DpadBinding } from "../../../shared/types/controls";
import type { Dir } from "../profileRead";
import { ARES, resolveQuartzKeyboardKeyIndex } from "../schema/ares";

const KEYBOARD_DEVICE_ID = 0x1;

function encodeKeyboard(domCode: string): string | null {
  const idx = resolveQuartzKeyboardKeyIndex(domCode);
  const tok = idx == null ? null : `0x${KEYBOARD_DEVICE_ID.toString(16)}/0/${idx};;`;

  return tok;
}

function encodeDigital(d?: DigitalBinding): string | null {
  if (!d) return null;
  if (d.type !== "key") return null;
  return encodeKeyboard(d.code);
}

function pickDir(dpad: DpadBinding | undefined, dir: Dir): DigitalBinding | undefined {
  if (!dpad || dpad.type !== "dpad") return undefined;
  if (dir === "up") return dpad.up;
  if (dir === "down") return dpad.down;
  if (dir === "left") return dpad.left;
  return dpad.right;
}

function dirFromMove(p1: PlayerBindings, dir: Dir): DigitalBinding | undefined {
  const m = p1.move;
  return m.type === "dpad" ? pickDir(m, dir) : undefined;
}

export class AresTranslator {
  translateFromPlayer(p1: PlayerBindings): Record<string, string> {
    const k = ARES.keys;
    const updates: Record<string, string> = {};

    const set = (key: string, d: DigitalBinding | undefined) => {
      const v = encodeDigital(d);
      if (v) updates[key] = v;
    };

    set(k.lUp, dirFromMove(p1, "up"));
    set(k.lDown, dirFromMove(p1, "down"));
    set(k.lLeft, dirFromMove(p1, "left"));
    set(k.lRight, dirFromMove(p1, "right"));

    set(k.dpadUp, pickDir(p1.dpad, "up"));
    set(k.dpadDown, pickDir(p1.dpad, "down"));
    set(k.dpadLeft, pickDir(p1.dpad, "left"));
    set(k.dpadRight, pickDir(p1.dpad, "right"));

    set(k.a, p1.face?.primary);
    set(k.b, p1.face?.secondary);
    set(k.x, p1.face?.tertiary);
    set(k.y, p1.face?.quaternary);

    set(k.start, p1.system?.start);
    set(k.select, p1.system?.select);

    set(k.l, p1.shoulders?.bumperL);
    set(k.r, p1.shoulders?.bumperR);
    set(k.rTrigger, p1.shoulders?.triggerR);

    set(k.z, p1.z);

    set(k.rUp, pickDir(p1.c, "up"));
    set(k.rDown, pickDir(p1.c, "down"));
    set(k.rLeft, pickDir(p1.c, "left"));
    set(k.rRight, pickDir(p1.c, "right"));

    return updates;
  }
}