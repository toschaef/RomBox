import type { PlayerBindings, DigitalBinding, ControlsProfile } from "../../../shared/types/controls";
import type { IEmulatorTranslator, EmulatorPatch, TranslateContext } from "./ITranslator";
import { ARES } from "../schema/ares";
import { pickDir, getDirFromBinding, digitalToGamepadToken } from "../profileRead";
import type { Platform } from "../../../shared/types";
import { KeycodeMapper } from "../keycodes/KeycodeMapper";
import { GP_FIXED_TO_INDEX } from "../../../shared/controls/gamepadTokens";
import { getSDLDeviceIndex } from "../schema/duckstation";
import path from "path";

const KEYBOARD_DEVICE_ID = 0x1;
const GAMEPAD_DEVICE_ID = 0x2;

function encodeKeyboard(domCode: string, platform: Platform = "darwin"): string | null {
  const mapped = KeycodeMapper.toKeycode("ares", domCode, platform);
  return mapped == null ? null : `0x${KEYBOARD_DEVICE_ID.toString(16)}/0/${mapped};;`;
}

function encodeGamepad(d: DigitalBinding, deviceIndex = 0): string | null {
  const tok = digitalToGamepadToken(d);
  if (!tok) return null;
  const idx = GP_FIXED_TO_INDEX[tok];
  if (idx === undefined) return null;
  return `0x${GAMEPAD_DEVICE_ID.toString(16)}/${deviceIndex}/${idx};;`;
}

function encodeDigital(d?: DigitalBinding, platform: Platform = "darwin", deviceIndex = 0): string | null {
  if (!d) return null;
  if (d.type === "key") {
    return encodeKeyboard(d.code, platform);
  }
  if (d.type === "gp_button" || d.type === "gp_axis_digital") {
    return encodeGamepad(d, deviceIndex);
  }
  return null;
}

export class AresTranslator implements IEmulatorTranslator {
  id = "ares";

  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[] {
    const platform = ctx.platform ?? "darwin";
    const deviceIndex = getSDLDeviceIndex(ctx, profile);
    const updates = this.translateFromPlayer(profile.player1, platform, deviceIndex);
    const patches: EmulatorPatch[] = [];
    const settingsPath = path.join(ctx.configDir || "", ARES.settingsFile);
    for (const [key, value] of Object.entries(updates)) {
      patches.push({
        kind: "ini-set",
        absPath: settingsPath,
        section: "VirtualPad1",
        key,
        value,
      });
    }
    return patches;
  }

  translateFromPlayer(p1: PlayerBindings, platform: Platform = "darwin", deviceIndex = 0): Record<string, string> {
    const k = ARES.keys;
    const updates: Record<string, string> = {};

    const set = (key: string, d: DigitalBinding | undefined) => {
      const v = encodeDigital(d, platform, deviceIndex);
      if (v) updates[key] = v;
    };

    set(k.lUp, getDirFromBinding(p1.move, "up"));
    set(k.lDown, getDirFromBinding(p1.move, "down"));
    set(k.lLeft, getDirFromBinding(p1.move, "left"));
    set(k.lRight, getDirFromBinding(p1.move, "right"));

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

    const specialN64 = p1.special?.type === "n64" ? p1.special : undefined;
    set(k.z, specialN64?.z ?? p1.shoulders?.triggerL);

    const cDpad = specialN64?.c;
    set(k.rUp, getDirFromBinding(cDpad, "up") ?? getDirFromBinding(p1.look, "up"));
    set(k.rDown, getDirFromBinding(cDpad, "down") ?? getDirFromBinding(p1.look, "down"));
    set(k.rLeft, getDirFromBinding(cDpad, "left") ?? getDirFromBinding(p1.look, "left"));
    set(k.rRight, getDirFromBinding(cDpad, "right") ?? getDirFromBinding(p1.look, "right"));

    return updates;
  }
}