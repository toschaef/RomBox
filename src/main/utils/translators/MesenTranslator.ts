import type { PlayerBindings, DigitalBinding } from "../../../shared/controls/types";
import { GP_FIXED_TO_INDEX, type GamepadToken } from "../../../shared/controls/gamepadTokens";
import { BASE_GAMEPAD, MESEN_KEYCODE_MAP_128, APPLE_KEYCODE_BY_CODE } from "../schema/mesen";
import { digitalToGamepadToken, type Dir } from "../profileRead";
import type { ConsoleID } from "../../../shared/types";

type Device = "keyboard" | "gamepad";
type DirSource = "dpad" | "move";

function mesenKeyboardCode(domCode: string): number | null {
  const apple = APPLE_KEYCODE_BY_CODE[domCode];
  if (apple === undefined || apple < 0 || apple >= MESEN_KEYCODE_MAP_128.length) return null;

  const mapped = MESEN_KEYCODE_MAP_128[apple] ?? 0;
  return mapped === 0 ? null : mapped;
}

function mesenGamepadCode(token: GamepadToken, port1Based: number): number {
  const idx = GP_FIXED_TO_INDEX[token];
  if (idx === undefined) {
      console.warn(`[mesen-debug] Unknown Gamepad Token: ${token}`);
      return 0;
  }
  const p = Math.max(1, port1Based) - 1;
  return BASE_GAMEPAD + p * 0x100 + idx;
}

function fixToken(tok: GamepadToken): GamepadToken {
  return tok;
}

function pickDir(
  dpad: { up?: DigitalBinding; down?: DigitalBinding; left?: DigitalBinding; right?: DigitalBinding },
  dir: Dir
) {
  if (dir === "up")   return dpad.up;
  if (dir === "down") return dpad.down;
  if (dir === "left") return dpad.left;

  return dpad.right;
}

function getDirFromPlayer(p1: PlayerBindings, src: DirSource, dir: Dir): DigitalBinding | undefined {
  if (src === "dpad") return pickDir(p1.dpad, dir);
  const m = p1.move;
  if (m.type === "dpad") return pickDir(m, dir);
  const stick = m.stick;
  const threshold = 0.65;
  const invX = !!m.invertX;
  const invY = !!m.invertY;
  if (dir === "left")  return { type: "gp_axis_digital", stick, axis: "x", dir: invX ? "pos" : "neg", threshold };
  if (dir === "right") return { type: "gp_axis_digital", stick, axis: "x", dir: invX ? "neg" : "pos", threshold };
  if (dir === "up")    return { type: "gp_axis_digital", stick, axis: "y", dir: invY ? "neg" : "pos", threshold };

  return { type: "gp_axis_digital", stick, axis: "y", dir: invY ? "pos" : "neg", threshold };
}

function translateDigital(d: DigitalBinding | undefined, player: number, device: Device | null): number | null {
  if (!d) return null;

  if (d.type === "key") {
    if (device && device !== "keyboard") return null;
    return mesenKeyboardCode(d.code);
  }

  const gpTok = digitalToGamepadToken(d);
  if (!gpTok) {
      return null;
  }
  
  if (device && device !== "gamepad") return null;

  return mesenGamepadCode(fixToken(gpTok), player);
}

export class MesenTranslator {
  translateForDeviceFromPlayer(
    p1: PlayerBindings,
    player = 1,
    device: Device | null,
    dirSource: DirSource,
    consoleId: ConsoleID,
  ): Record<string, number> {
    const mapping: Record<string, number> = {};

    const setDir = (mesenKey: "Up" | "Down" | "Left" | "Right", dir: Dir) => {
      const v = translateDigital(getDirFromPlayer(p1, dirSource, dir), player, device);
      if (v !== null) mapping[mesenKey] = v;
    };

    setDir("Up", "up");
    setDir("Down", "down");
    setDir("Left", "left");
    setDir("Right", "right");

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