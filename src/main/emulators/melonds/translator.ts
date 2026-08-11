import type {
  EmulatorPatch,
  IEmulatorTranslator,
  TranslateContext,
  LearnedBinds
} from "../translatorTypes";
import type { ControlsProfile, PlayerBindings, DigitalBinding } from "../../../shared/types/controls";
import { digitalToGamepadToken, type Dir } from "../../utils/profileRead";
import { MELONDS, melondsJoyCodeForToken, melondsJoyCodeFromLearnedBind } from "./schema";
import type { GamepadToken } from "../../../shared/controls/gamepadTokens";
import type { Platform } from "../../../shared/types";

const { ROOT, KB_TABLE, JOY_TABLE } = MELONDS;

const DIRS = ["Up", "Down", "Left", "Right"] as const;
type DirKey = (typeof DIRS)[number];

function dirKeyToDir(k: DirKey): Dir {
  if (k === "Up")   return "up";
  if (k === "Down") return "down";
  if (k === "Left") return "left";
  return "right";
}

function melonFixToken(tok: GamepadToken): GamepadToken {
  if (tok === "GP_LS_UP")   return "GP_LS_DOWN";
  if (tok === "GP_LS_DOWN") return "GP_LS_UP";
  if (tok === "GP_RS_UP")   return "GP_RS_DOWN";
  if (tok === "GP_RS_DOWN") return "GP_RS_UP";

  return tok;
}
function firstKeyboard(d?: DigitalBinding): string | null {
  if (!d) return null;
  return d.type === "key" ? d.code : null;
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

function getDirFromPlayer(p1: PlayerBindings, dir: Dir): DigitalBinding | undefined {
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

function digitalToMelonToken(d?: DigitalBinding): GamepadToken | null {
  if (!d) return null;

  const tok = digitalToGamepadToken(d);
  if (tok) return tok;

  if (d.type === "gp_axis_digital") {
    const { stick, axis, dir } = d;

    if (stick === "left") {
      if (axis === "x") return dir === "pos" ? "GP_LS_RIGHT" : "GP_LS_LEFT";
      return dir === "pos" ? "GP_LS_DOWN" : "GP_LS_UP";
    } else {
      if (axis === "x") return dir === "pos" ? "GP_RS_RIGHT" : "GP_RS_LEFT";
      return dir === "pos" ? "GP_RS_DOWN" : "GP_RS_UP";
    }
  }

  return null;
}

function resolveJoyCode(tok: GamepadToken, learnedBinds?: LearnedBinds): number {
  const fixed = melonFixToken(tok);
  const learned = learnedBinds?.[fixed];
  if (learned) return melondsJoyCodeFromLearnedBind(learned);
  return melondsJoyCodeForToken(fixed);
}

function toMelonJoyCode(d: DigitalBinding | undefined, learnedBinds?: LearnedBinds): number {
  const tok = digitalToMelonToken(d);
  if (!tok) return -1;
  return resolveJoyCode(tok, learnedBinds);
}

export class MelonDSTranslator implements IEmulatorTranslator {
  id = "melonds";

  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[] {
    return this.translateFromPlayer(
      profile.player1,
      ctx,
      profile.melonJoystickId ?? 0
    );
  }

  /** melonDS only ever configures player 1. */
  private translateFromPlayer(
    p1: PlayerBindings,
    ctx: TranslateContext,
    joystickId: number
  ): EmulatorPatch[] {
    const patches: EmulatorPatch[] = [];
    const platform = ctx.platform;
    const learnedBinds = ctx.learnedBinds;

    patches.push({
      kind: "ini-set",
      section: MELONDS.INSTANCE,
      key: "JoystickID",
      value: String(joystickId),
    });

    for (const k of DIRS) {
      const dir = dirKeyToDir(k);

      const dpadBind = pickDir(p1.dpad, dir);
      const moveBind = getDirFromPlayer(p1, dir);

      const dpadTok = digitalToMelonToken(dpadBind);
      const moveTok = digitalToMelonToken(moveBind);

      const dpadCode = dpadTok ? resolveJoyCode(dpadTok, learnedBinds) : -1;
      const moveCode = moveTok ? resolveJoyCode(moveTok, learnedBinds) : -1;

      let finalJoy = -1;

      if (moveCode !== -1 && dpadCode !== -1) {
        finalJoy = (moveCode & 0xffff0000) | (dpadCode & 0xffff);
      } else {
        finalJoy = moveCode !== -1 ? moveCode : dpadCode;
      }

      patches.push({ kind: "ini-set", section: JOY_TABLE, key: k, value: String(finalJoy) });

      const kb = firstKeyboard(dpadBind) ?? firstKeyboard(moveBind);
      const kbCode = kb ? toMelonKeyboardCode(kb, platform) : -1;
      patches.push({ kind: "ini-set", section: KB_TABLE, key: k, value: String(kbCode) });
    }

    const binds: Array<[string, DigitalBinding | undefined]> = [
      ["A", p1.face.primary],
      ["B", p1.face.secondary],
      ["X", p1.face.tertiary],
      ["Y", p1.face.quaternary],

      ["L", p1.shoulders.bumperL],
      ["R", p1.shoulders.bumperR],

      ["Start", p1.system.start],
      ["Select", p1.system.select],
    ];

    for (const [key, bind] of binds) {
      const kb = firstKeyboard(bind);
      const melonCode = kb ? toMelonKeyboardCode(kb, platform) : -1;
      const joyCode = toMelonJoyCode(bind, learnedBinds);

      patches.push({ kind: "ini-set", section: KB_TABLE, key, value: String(melonCode) });
      patches.push({ kind: "ini-set", section: ROOT, key: `Key_${key}`, value: String(melonCode) });
      patches.push({ kind: "ini-set", section: JOY_TABLE, key, value: String(joyCode) });
    }

    return patches;
  }
}

function toMelonKeyboardCode(domCode: string, platform: Platform): number {
  const s = domCode.trim();

  if (/^Key[A-Z]$/.test(s)) return s.charCodeAt(3);
  if (/^Digit[0-9]$/.test(s)) return s.charCodeAt(5);
  if (s === "Space") return 32;
  if (s === "Enter") return 0x01000004; // Qt::Key_Return
  if (s === "NumpadEnter") return 0x01000005; // Qt::Key_Enter
  if (s === "Tab") return 0x01000001; // Qt::Key_Tab
  if (s === "Backspace") return 0x01000003; // Qt::Key_Backspace
  if (s === "Escape") return 0x01000000; // Qt::Key_Escape

  const KEYPAD_MOD = platform === "win32" ? 0x20000000 : 0;
  if (s === "ArrowLeft") return 0x01000012 | KEYPAD_MOD;
  if (s === "ArrowUp") return 0x01000013 | KEYPAD_MOD;
  if (s === "ArrowRight") return 0x01000014 | KEYPAD_MOD;
  if (s === "ArrowDown") return 0x01000015 | KEYPAD_MOD;
  return -1;
}