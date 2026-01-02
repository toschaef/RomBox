import type { ControlsProfile, DigitalBinding } from "../../../shared/controls/types";
import { GP_FIXED_TO_INDEX, type GamepadToken } from "../../../shared/controls/gamepadTokens";
import { BASE_GAMEPAD, MESEN_KEYCODE_MAP_128, APPLE_KEYCODE_BY_CODE } from "../schema/mesen";
import { digitalToGamepadToken, getDirFromDpad, getDirFromMove, type Dir } from "../profileRead";

type Device = "keyboard" | "gamepad";
type DirSource = "dpad" | "move";

function mesenKeyboardCode(code: string): number | null {
  const apple = APPLE_KEYCODE_BY_CODE[code];
  if (apple === undefined || apple < 0 || apple >= 128) return null;
  const mapped = MESEN_KEYCODE_MAP_128[apple] ?? 0;
  return mapped === 0 ? null : mapped;
}

function mesenGamepadCode(token: GamepadToken, port1Based: number): number {
  const idx = GP_FIXED_TO_INDEX[token];
  const p = Math.max(1, port1Based) - 1;
  return BASE_GAMEPAD + p * 0x100 + idx;
}

function translateDigital(d: DigitalBinding | undefined, player: number, device: Device | null): number | null {
  if (!d) return null;

  if (d.type === "key") {
    if (device && device !== "keyboard") return null;
    return mesenKeyboardCode(d.code);
  }

  const gpTok = digitalToGamepadToken(d);
  if (!gpTok) return null;
  if (device && device !== "gamepad") return null;
  return mesenGamepadCode(gpTok, player);
}

function getDir(profile: ControlsProfile, src: DirSource, dir: Dir): DigitalBinding | undefined {
  return src === "dpad" ? getDirFromDpad(profile, dir) : getDirFromMove(profile, dir);
}

export class MesenTranslator {
  translateForDevice(
    profile: ControlsProfile,
    player = 1,
    device: Device | null,
    dirSource: DirSource
  ): Record<string, number> {
    const p1 = profile.player1;
    const mapping: Record<string, number> = {};

    const up = translateDigital(getDir(profile, dirSource, "up"), player, device);
    const down = translateDigital(getDir(profile, dirSource, "down"), player, device);
    const left = translateDigital(getDir(profile, dirSource, "left"), player, device);
    const right = translateDigital(getDir(profile, dirSource, "right"), player, device);

    if (up !== null) mapping["Up"] = up;
    if (down !== null) mapping["Down"] = down;
    if (left !== null) mapping["Left"] = left;
    if (right !== null) mapping["Right"] = right;

    const set = (mesenKey: string, d?: DigitalBinding) => {
      const v = translateDigital(d, player, device);
      if (v !== null) mapping[mesenKey] = v;
    };

    set("A", p1.face.primary);
    set("B", p1.face.secondary);
    set("X", p1.face.tertiary);
    set("Y", p1.face.quaternary);

    set("L", p1.shoulders.bumperL);
    set("R", p1.shoulders.bumperR);
    set("L2", p1.shoulders.triggerL);
    set("R2", p1.shoulders.triggerR);

    set("Start", p1.system.start);
    set("Select", p1.system.select);

    return mapping;
  }
}