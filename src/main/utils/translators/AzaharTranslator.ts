import type { EmulatorPatch, TranslateContext } from "./ITranslator";
import type { DigitalBinding } from "../../../shared/types/controls";
import type { PlayerBindings } from "../../../shared/types/controls";
import { digitalToGamepadToken } from "../profileRead";
import { AZAHAR, azProfileKey, azProfileDefaultKey, qtKeycodeFromDomCode } from "../schema/azahar";
import type { AzaharLearnedSDL } from "../azahar/sdlprobe";



function profileValueForDigital(d: DigitalBinding | undefined, learned: AzaharLearnedSDL | null): string | null {
  if (!d) return null;

  if (d.type === "key") {
    const qt = qtKeycodeFromDomCode(d.code);
    if (qt == null) return null;
    return `"code:${qt},engine:keyboard"`;
  }

  const tok = digitalToGamepadToken(d);
  if (!tok) return null;
  if (!learned?.guid) return null;

  const entry = learned.binds[tok];
  if (!entry) return null;

  const guid = learned.guid;
  const port = learned.port ?? 0;

  if (entry.kind === "button") return `"button:${entry.button},engine:sdl,guid:${guid},port:${port}"`;
  if (entry.kind === "hat") return `"direction:${entry.direction},engine:sdl,guid:${guid},hat:${entry.hat},port:${port}"`;
  return `"axis:${entry.axis},direction:${entry.direction},engine:sdl,guid:${guid},port:${port},threshold:${entry.threshold}"`;
}

function azKeyPart(which: "up" | "down" | "left" | "right" | "modifier", d: DigitalBinding): string | null {
  if (d.type !== "key") return null;
  const qt = qtKeycodeFromDomCode(d.code);
  if (qt == null) return null;
  return `${which}:code$0${qt}$1engine$0keyboard`;
}

function keyboardAnalogBlob(args: {
  up: DigitalBinding;
  down: DigitalBinding;
  left: DigitalBinding;
  right: DigitalBinding;
  modifier: DigitalBinding;
  modifierScale?: string;
}): string | null {
  const up = azKeyPart("up", args.up);
  const down = azKeyPart("down", args.down);
  const left = azKeyPart("left", args.left);
  const right = azKeyPart("right", args.right);
  const mod = azKeyPart("modifier", args.modifier);
  if (!up || !down || !left || !right || !mod) return null;

  const scale = args.modifierScale ?? "0.500000";
  return [down, "engine:analog_from_button", left, mod, `modifier_scale:${scale}`, right, up].join(",");
}

function isFourKeyDpad(x: any): x is { type: "dpad"; up: DigitalBinding; down: DigitalBinding; left: DigitalBinding; right: DigitalBinding } {
  return !!x &&
    x.type === "dpad" &&
    x.up?.type === "key" &&
    x.down?.type === "key" &&
    x.left?.type === "key" &&
    x.right?.type === "key";
}

function isStickBinding(x: any): boolean {
  return !!x && x.type === "stick";
}

function pickModifierFromMove(move: any): DigitalBinding {
  return { type: "key", code: "ShiftLeft" };
}

export class AzaharTranslator {
  id = "azahar";
  constructor(private learned: AzaharLearnedSDL | null) {}

  translate(args: {
    bindings: PlayerBindings;
    ctx: TranslateContext;
  }): EmulatorPatch[] {
    const { bindings } = args;
    const patches: EmulatorPatch[] = [];

    const idx = AZAHAR.activeProfileIndex;

    patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, "name"), value: AZAHAR.profileName });
    patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, "name"), value: "false" });

    const b: any = bindings as any;

    const move = b.move;
    const look = b.look;

    if (isFourKeyDpad(move)) {
      const mod = pickModifierFromMove(move);
      const blob = keyboardAnalogBlob({
        up: move.up,
        down: move.down,
        left: move.left,
        right: move.right,
        modifier: mod,
      });
      if (blob) {
        patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.circle_pad), value: `"${blob}"` });
        patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.circle_pad), value: "false" });
      }
    } else if (isStickBinding(move)) {
      if (this.learned?.sticks?.circle_pad) {
        patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.circle_pad), value: `"${this.learned.sticks.circle_pad}"` });
        patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.circle_pad), value: "false" });
      }
    } else {
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.circle_pad), value: AZAHAR.paramEmpty });
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.circle_pad), value: "false" });
    }

    if (isFourKeyDpad(look)) {
      const mod = pickModifierFromMove(move);
      const blob = keyboardAnalogBlob({
        up: look.up,
        down: look.down,
        left: look.left,
        right: look.right,
        modifier: mod,
      });
      if (blob) {
        patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.c_stick), value: `"${blob}"` });
        patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.c_stick), value: "false" });
      }
    } else if (isStickBinding(look)) {
      if (this.learned?.sticks?.c_stick) {
        patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.c_stick), value: `"${this.learned.sticks.c_stick}"` });
        patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.c_stick), value: "false" });
      }
    } else {
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.c_stick), value: AZAHAR.paramEmpty });
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.c_stick), value: "false" });
    }

    const kv: Array<[string, DigitalBinding | undefined]> = [
      [AZAHAR.keys.button_up, b.dpad?.up],
      [AZAHAR.keys.button_down, b.dpad?.down],
      [AZAHAR.keys.button_left, b.dpad?.left],
      [AZAHAR.keys.button_right, b.dpad?.right],

      [AZAHAR.keys.button_a, b.face?.primary],
      [AZAHAR.keys.button_b, b.face?.secondary],
      [AZAHAR.keys.button_x, b.face?.tertiary],
      [AZAHAR.keys.button_y, b.face?.quaternary],

      [AZAHAR.keys.button_l, b.shoulders?.bumperL],
      [AZAHAR.keys.button_r, b.shoulders?.bumperR],
      [AZAHAR.keys.button_zl, b.shoulders?.triggerL],
      [AZAHAR.keys.button_zr, b.shoulders?.triggerR],

      [AZAHAR.keys.button_start, b.system?.start],
      [AZAHAR.keys.button_select, b.system?.select],
    ];

    for (const [key, bind] of kv) {
      if (!bind) continue;
      const learnedNeeded = bind.type !== "key";
      const v = profileValueForDigital(bind, learnedNeeded ? this.learned : null);
      if (!v) continue;

      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, key), value: v });
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, key), value: "false" });
    }

    return patches;
  }
}