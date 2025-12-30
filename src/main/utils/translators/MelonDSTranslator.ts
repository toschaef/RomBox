import type { IEmulatorTranslator, TranslateContext, EmulatorPatch } from "./ITranslator";
import type { ActionBindings, PhysicalBinding } from "../../../shared/types/controls";

const ROOT = "";
const KB_TABLE = "Instance0.Keyboard";

type ResolvedBind = {
  key: string;
  input: string | null;
  qtCode: number;
};

export class MelonDSTranslator implements IEmulatorTranslator {
  id = "melonds";
  platform: any = undefined;

  translate(bindings: ActionBindings, _ctx: TranslateContext): EmulatorPatch[] {
    const resolved = resolveMelonDSKeyboard(bindings);

    const unknown = resolved.filter(r => r.input && r.qtCode === -1);
    if (unknown.length) console.warn("[melonds][translate] unknown inputs -> -1:", unknown);

    const bound = resolved.filter(r => r.qtCode !== -1).map(r => `${r.key}=${r.qtCode}`);
    console.log(`[melonds][translate] bound ${bound.length}/${resolved.length}:`, bound.join(", "));

    const patches: EmulatorPatch[] = [];

    for (const r of resolved) {
      patches.push({
        kind: "ini-set",
        section: KB_TABLE,
        key: r.key,
        value: String(r.qtCode),
      });
    }

    for (const r of resolved) {
      patches.push({
        kind: "ini-set",
        section: ROOT,
        key: `Key_${r.key}`,
        value: String(r.qtCode),
      });
    }

    return patches;
  }
}

function resolveMelonDSKeyboard(bindings: ActionBindings): ResolvedBind[] {
  const key = (action: keyof ActionBindings) => firstKeyboard(bindings[action]);

  const map = [
    ["Up", key("MOVE_UP")],
    ["Down", key("MOVE_DOWN")],
    ["Left", key("MOVE_LEFT")],
    ["Right", key("MOVE_RIGHT")],

    ["A", key("FACE_PRIMARY")],
    ["B", key("FACE_SECONDARY")],
    ["X", key("FACE_TERTIARY")],
    ["Y", key("FACE_QUATERNARY")],

    ["L", key("BUMPER_L")],
    ["R", key("BUMPER_R")],

    ["Start", key("START")],
    ["Select", key("SELECT")],
  ] as const;

  return map.map(([k, bind]) => ({
    key: k,
    input: bind?.input ?? null,
    qtCode: bind ? toQtKeyCode(bind.input) : -1,
  }));
}

function firstKeyboard(arr: PhysicalBinding[] | undefined): PhysicalBinding | null {
  if (!arr) return null;
  for (const b of arr) if (b.device === "keyboard") return b;
  return null;
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
