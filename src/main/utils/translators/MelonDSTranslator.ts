import type { IEmulatorTranslator, TranslateContext, EmulatorPatch } from "./ITranslator";
import type { ControlsProfile, DigitalBinding } from "../../../shared/controls/types";
import { getDirFromMove, getDirFromDpad, digitalToGamepadToken } from "../profileRead";
import { MELONDS, melondsJoyCodeForToken } from "../schema/melonds";
import type { GamepadToken } from "../../../shared/controls/gamepadTokens";

const { ROOT, KB_TABLE, JOY_TABLE } = MELONDS;

const DIRS = ["Up", "Down", "Left", "Right"] as const;
type DirKey = (typeof DIRS)[number];

function dirKeyToDir(k: DirKey) {
  if (k === "Up") return "up";
  if (k === "Down") return "down";
  if (k === "Left") return "left";
  return "right";
}

function melonFixToken(tok: GamepadToken): GamepadToken {
  if (tok === "GP_LS_UP") return "GP_LS_DOWN";
  if (tok === "GP_LS_DOWN") return "GP_LS_UP";
  if (tok === "GP_RS_UP") return "GP_RS_DOWN";
  if (tok === "GP_RS_DOWN") return "GP_RS_UP";

  return tok;
}
function firstKeyboard(d?: DigitalBinding): string | null {
  if (!d) return null;
  return d.type === "key" ? d.code : null;
}

function toMelonJoyCode(d?: DigitalBinding): number {
  if (!d) return -1;
  const tok = digitalToGamepadToken(d);
  if (!tok) return -1;
  return melondsJoyCodeForToken(tok);
}

export class MelonDSTranslator implements IEmulatorTranslator {
  id = "melonds";

  translate(profile: ControlsProfile, _ctx: TranslateContext): EmulatorPatch[] {
    const p1 = profile.player1;
    const patches: EmulatorPatch[] = [];

    const joystickId = profile.melonJoystickId ?? 0;

    patches.push({
      kind: "ini-set",
      section: MELONDS.INSTANCE,
      key: "JoystickID",
      value: String(joystickId),
    });

    for (const k of DIRS) {
      const dir = dirKeyToDir(k);
      const move = profile.player1.move;

      const stickBind = move.type === "stick" ? getDirFromMove(profile, dir) : undefined;
      const dpadBind = getDirFromDpad(profile, dir);

      const stickTok = stickBind ? digitalToGamepadToken(stickBind) : null;
      const dpadTok = dpadBind ? digitalToGamepadToken(dpadBind) : null;

      const stickCode = stickTok ? melondsJoyCodeForToken(melonFixToken(stickTok)) : -1;
      const dpadCode = dpadTok ? melondsJoyCodeForToken(melonFixToken(dpadTok)) : -1;

      let finalCode = -1;

      if (move.type === "stick") {
        if (stickCode !== -1 && dpadCode !== -1) {
          finalCode = (stickCode & 0xffff0000) | (dpadCode & 0xffff);
        } else {
          finalCode = stickCode !== -1 ? stickCode : dpadCode;
        }
      } else {
        const bind = dpadBind ?? getDirFromMove(profile, dir);
        const tok = bind ? digitalToGamepadToken(bind) : null;
        finalCode = tok ? melondsJoyCodeForToken(tok) : -1;
      }

      patches.push({ kind: "ini-set", section: JOY_TABLE, key: k, value: String(finalCode) });

      const kb = firstKeyboard(move.type === "stick" ? stickBind : (dpadBind ?? getDirFromMove(profile, dir)));
      const qtCode = kb ? toQtKeyCode(kb) : -1;
      patches.push({ kind: "ini-set", section: KB_TABLE, key: k, value: String(qtCode) });
      patches.push({ kind: "ini-set", section: ROOT, key: `Key_${k}`, value: String(qtCode) });
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
      const qtCode = kb ? toQtKeyCode(kb) : -1;

      const tok = bind ? digitalToGamepadToken(bind) : null;
      const joyCode = tok ? melondsJoyCodeForToken(tok) : -1;

      patches.push({ kind: "ini-set", section: KB_TABLE, key, value: String(qtCode) });
      patches.push({ kind: "ini-set", section: ROOT, key: `Key_${key}`, value: String(qtCode) });

      patches.push({ kind: "ini-set", section: JOY_TABLE, key, value: String(joyCode) });


    }

    return patches;
  }
}

function toQtKeyCode(input: string): number {
  const s = input.trim();
  if (s === "ArrowLeft") return 16777234;
  if (s === "ArrowUp") return 16777235;
  if (s === "ArrowRight") return 16777236;
  if (s === "ArrowDown") return 16777237;
  if (s === "Enter") return 16777220;
  if (s === "Escape") return 16777216;
  if (s === "Space") return 32;
  if (s === "Tab") return 16777217;
  if (s === "Backspace") return 16777219;
  if (s === "Shift" || s === "ShiftLeft") return 42;
  if (s === "ShiftRight") return 54;
  if (s === "Control" || s === "ControlLeft") return 29;
  if (s === "ControlRight") return 285;
  if (s === "Alt" || s === "AltLeft") return 56;
  if (s === "AltRight") return 312;
  if (/^Key[A-Z]$/.test(s)) return s.charCodeAt(3);
  if (/^[A-Z]$/.test(s)) return s.charCodeAt(0);
  if (/^Digit[0-9]$/.test(s)) return s.charCodeAt(5);
  if (/^[0-9]$/.test(s)) return s.charCodeAt(0);
  const f = s.match(/^F([1-9]|1[0-2])$/);
  if (f) return 16777264 + (parseInt(f[1], 10) - 1);
  return -1;
}