import type { AnyConsoleLayout, DigitalBinding, SpecialBinding } from "../../shared/types/controls";
import type { ConsoleID } from "../../shared/types";

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
  if (!next[playerKey]) next[playerKey] = {} as any;
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