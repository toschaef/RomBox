import type { EmulatorPatch, TranslateContext } from "./ITranslator";
import type { DigitalBinding, PlayerBindings } from "../../../shared/types/controls";
import { digitalToGamepadToken, getDirFromBinding } from "../profileRead";
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

function azDigitalPart(
  which: "up" | "down" | "left" | "right" | "modifier",
  d: DigitalBinding,
  learned: AzaharLearnedSDL | null,
): string | null {
  if (d.type === "key") {
    const qt = qtKeycodeFromDomCode(d.code);
    if (qt == null) return null;
    return `${which}:code$0${qt}$1engine$0keyboard`;
  }

  const tok = digitalToGamepadToken(d);
  if (!tok) return null;
  if (!learned?.guid) return null;

  const entry = learned.binds[tok];
  if (!entry) return null;

  const guid = learned.guid;
  const port = learned.port ?? 0;

  if (entry.kind === "button") {
    return `${which}:button$0${entry.button}$1engine$0sdl$1guid$0${guid}$1port$0${port}`;
  }
  if (entry.kind === "hat") {
    return `${which}:direction$0${entry.direction}$1engine$0sdl$1guid$0${guid}$1hat$0${entry.hat}$1port$0${port}`;
  }
  // axis
  return `${which}:axis$0${entry.axis}$1direction$0${entry.direction}$1engine$0sdl$1guid$0${guid}$1port$0${port}$1threshold$0${entry.threshold}`;
}

function analogFromButtonsBlob(args: {
  up: DigitalBinding;
  down: DigitalBinding;
  left: DigitalBinding;
  right: DigitalBinding;
  modifier?: DigitalBinding;
  modifierScale?: string;
  learned: AzaharLearnedSDL | null;
}): string | null {
  const up = azDigitalPart("up", args.up, args.learned);
  const down = azDigitalPart("down", args.down, args.learned);
  const left = azDigitalPart("left", args.left, args.learned);
  const right = azDigitalPart("right", args.right, args.learned);

  if (!up || !down || !left || !right) return null;

  const parts = [down, "engine:analog_from_button", left];

  if (args.modifier) {
    const mod = azDigitalPart("modifier", args.modifier, args.learned);
    if (mod) {
      parts.push(mod);
      const scale = args.modifierScale ?? "0.500000";
      parts.push(`modifier_scale:${scale}`);
    }
  }

  parts.push(right, up);
  return parts.join(",");
}

function pickModifierFromMove(): DigitalBinding {
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

    const move = bindings.move;
    const look = bindings.look;

    // Circle Pad
    let circlePadBlob: string | null = null;
    if (move.type === "stick") {
      if (this.learned?.sticks?.circle_pad) {
        circlePadBlob = this.learned.sticks.circle_pad;
      } else {
        const up = getDirFromBinding(move, "up");
        const down = getDirFromBinding(move, "down");
        const left = getDirFromBinding(move, "left");
        const right = getDirFromBinding(move, "right");
        if (up && down && left && right) {
          circlePadBlob = analogFromButtonsBlob({
            up, down, left, right,
            modifier: pickModifierFromMove(),
            learned: this.learned,
          });
        }
      }
    } else {
      circlePadBlob = analogFromButtonsBlob({
        up: move.up || { type: "key", code: "KeyW" },
        down: move.down || { type: "key", code: "KeyS" },
        left: move.left || { type: "key", code: "KeyA" },
        right: move.right || { type: "key", code: "KeyD" },
        modifier: pickModifierFromMove(),
        learned: this.learned,
      });
    }

    if (circlePadBlob) {
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.circle_pad), value: `"${circlePadBlob}"` });
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.circle_pad), value: "false" });
    } else {
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.circle_pad), value: AZAHAR.paramEmpty });
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.circle_pad), value: "false" });
    }

    // C-Stick
    let cStickBlob: string | null = null;
    if (look.type === "stick") {
      if (this.learned?.sticks?.c_stick) {
        cStickBlob = this.learned.sticks.c_stick;
      } else {
        const up = getDirFromBinding(look, "up");
        const down = getDirFromBinding(look, "down");
        const left = getDirFromBinding(look, "left");
        const right = getDirFromBinding(look, "right");
        if (up && down && left && right) {
          cStickBlob = analogFromButtonsBlob({
            up, down, left, right,
            modifier: pickModifierFromMove(),
            learned: this.learned,
          });
        }
      }
    } else {
      cStickBlob = analogFromButtonsBlob({
        up: look.up || { type: "key", code: "ArrowUp" },
        down: look.down || { type: "key", code: "ArrowDown" },
        left: look.left || { type: "key", code: "ArrowLeft" },
        right: look.right || { type: "key", code: "ArrowRight" },
        modifier: pickModifierFromMove(),
        learned: this.learned,
      });
    }

    if (cStickBlob) {
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.c_stick), value: `"${cStickBlob}"` });
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.c_stick), value: "false" });
    } else {
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileKey(idx, AZAHAR.keys.c_stick), value: AZAHAR.paramEmpty });
      patches.push({ kind: "ini-set", section: AZAHAR.sections.controls, key: azProfileDefaultKey(idx, AZAHAR.keys.c_stick), value: "false" });
    }

    const kv: Array<[string, DigitalBinding | undefined]> = [
      [AZAHAR.keys.button_up, bindings.dpad?.up],
      [AZAHAR.keys.button_down, bindings.dpad?.down],
      [AZAHAR.keys.button_left, bindings.dpad?.left],
      [AZAHAR.keys.button_right, bindings.dpad?.right],

      [AZAHAR.keys.button_a, bindings.face?.primary],
      [AZAHAR.keys.button_b, bindings.face?.secondary],
      [AZAHAR.keys.button_x, bindings.face?.tertiary],
      [AZAHAR.keys.button_y, bindings.face?.quaternary],

      [AZAHAR.keys.button_l, bindings.shoulders?.bumperL],
      [AZAHAR.keys.button_r, bindings.shoulders?.bumperR],
      [AZAHAR.keys.button_zl, bindings.shoulders?.triggerL],
      [AZAHAR.keys.button_zr, bindings.shoulders?.triggerR],

      [AZAHAR.keys.button_start, bindings.system?.start],
      [AZAHAR.keys.button_select, bindings.system?.select],
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