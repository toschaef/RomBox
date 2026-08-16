import type { AnyConsoleLayout, DigitalBinding, DpadBinding, StickBinding, SpecialBinding, PlayerBindings } from "../../../../shared/types/controls";
import type { ConsoleID } from "../../../../shared/types";
import { defaultDpad, defaultStick } from "./bindingDefaults";

export type ConsoleGroupId = "move" | "dpad" | "look" | "special.c" | "special" | "special.wiimoteDpad" | "special.tilt" | "special.ir";

// Every translator gates its special-binding handling on this discriminant
// (e.g. AresTranslator only reads Z/C-buttons when `special.type === "n64"`),
// so a "special" group built without it is silently ignored no matter what's
// inside - the group must be seeded with the right type the moment it's
// first created, not left as a bare object.
export function specialTypeForConsole(consoleId: ConsoleID): SpecialBinding["type"] | undefined {
  if (consoleId === "n64") return "n64";
  if (consoleId === "gc") return "gc";
  if (consoleId === "wii") return "wii";
  return undefined;
}

export function getConsoleDigital(layout: AnyConsoleLayout, playerKey: "player1" | "player2" | "player3" | "player4", id: string): DigitalBinding | undefined {
  const b = (layout as unknown as Record<string, unknown>)[playerKey] as Record<string, unknown> ?? {};

  if (!id.includes(".")) {
    const v = b[id];
    return isDigital(v) ? (v as DigitalBinding) : undefined;
  }

  const [group, key] = id.split(".", 2);
  const groupObj = b[group];
  const v = groupObj && typeof groupObj === "object" ? (groupObj as Record<string, unknown>)[key] : undefined;
  return isDigital(v) ? (v as DigitalBinding) : undefined;
}

export function setConsoleDigital(layout: AnyConsoleLayout, playerKey: "player1" | "player2" | "player3" | "player4", path: string, value: DigitalBinding): AnyConsoleLayout {
  const next = structuredClone(layout);
  if (!next[playerKey]) next[playerKey] = {} as PlayerBindings;
  let parent = next[playerKey] as unknown as Record<string, unknown>;
  const parts = path.split(".");

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!parent[part] || typeof parent[part] !== "object") {
      parent[part] = part === "special" ? { type: specialTypeForConsole(next.consoleId) } : {};
    }
    parent = parent[part] as Record<string, unknown>;
  }
  parent[parts[parts.length - 1]] = value;
  return next;
}

export function clearConsoleDigital(layout: AnyConsoleLayout, playerKey: "player1" | "player2" | "player3" | "player4", id: string): AnyConsoleLayout {
  const next = structuredClone(layout);
  if (!next[playerKey]) return next;
  const b = next[playerKey] as unknown as Record<string, unknown>;

  if (!id.includes(".")) {
    delete b[id];
    return next;
  }

  const [group, key] = id.split(".", 2);
  const groupObj = b[group];
  if (groupObj && typeof groupObj === "object") {
    delete (groupObj as Record<string, unknown>)[key];
  }
  return next;
}

function isDigital(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const type = (v as Record<string, unknown>).type;
  return type === "key" || type === "gp_button" || type === "gp_axis_digital";
}

export function getConsoleGroupValue(layout: AnyConsoleLayout, playerKey: "player1" | "player2" | "player3" | "player4", group: ConsoleGroupId): DpadBinding | StickBinding {
  let v: unknown = layout[playerKey];
  if (!v) return { type: "dpad" };
  const parts = group.split(".");
  for (const part of parts) {
    v = v && typeof v === "object" ? (v as Record<string, unknown>)[part] : undefined;
  }
  if (!v || typeof v !== "object") return { type: "dpad" };
  const t = (v as Record<string, unknown>).type;
  if (t === "dpad" || t === "stick") return v as DpadBinding | StickBinding;
  return { type: "dpad" };
}

export function setConsoleGroupMode(layout: AnyConsoleLayout, playerKey: "player1" | "player2" | "player3" | "player4", group: ConsoleGroupId, mode: "dpad" | "stick"): AnyConsoleLayout {
  const next = structuredClone(layout);

  const stick: "left" | "right" = (group === "special.c" || group === "look" || group === "special.tilt" || group === "special.ir") ? "right" : "left";
  const val = mode === "dpad" ? defaultDpad() : defaultStick(stick);

  if (!next[playerKey]) next[playerKey] = {} as PlayerBindings;
  let parent: Record<string, unknown> = next[playerKey] as unknown as Record<string, unknown>;
  const parts = group.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!parent[part] || typeof parent[part] !== "object") {
      parent[part] = {};
    }
    parent = parent[part] as Record<string, unknown>;
  }
  parent[parts[parts.length - 1]] = val;

  return next;
}

export function clearConsoleGroup(layout: AnyConsoleLayout, playerKey: "player1" | "player2" | "player3" | "player4", group: ConsoleGroupId): AnyConsoleLayout {
  const next = structuredClone(layout);

  if (!next[playerKey]) return next;
  let parent: Record<string, unknown> = next[playerKey] as unknown as Record<string, unknown>;
  const parts = group.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!parent[part] || typeof parent[part] !== "object") {
      parent[part] = {};
    }
    parent = parent[part] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1];
  const current = parent[lastKey] as { type?: string; stick?: "left" | "right"; deadzone?: number } | undefined;

  if (current?.type === "stick") {
    parent[lastKey] = { type: "stick", stick: current.stick ?? "left", deadzone: current.deadzone ?? 0.15 };
  } else {
    parent[lastKey] = { type: "dpad" };
  }

  return next;
}
