import type { ControlsProfile, AnyConsoleLayout, DigitalBinding, DpadBinding, StickBinding } from "../../../shared/types/controls";

export type DigitalPath =
  | "face.primary"
  | "face.secondary"
  | "face.tertiary"
  | "face.quaternary"
  | "shoulders.bumperL"
  | "shoulders.bumperR"
  | "shoulders.triggerL"
  | "shoulders.triggerR"
  | "sticks.l3"
  | "sticks.r3"
  | "system.start"
  | "system.select";

export type ConsoleGroupId = "move" | "dpad" | "look" | "special.c" | "special" | "special.wiimoteDpad" | "special.tilt" | "special.ir";

export function defaultStick(stick: "left" | "right"): StickBinding {
  return { type: "stick", stick, deadzone: 0.15 };
}

export function defaultDpad(): DpadBinding {
  return { type: "dpad" };
}

export function getDigital(p: ControlsProfile, playerKey: "player1" | "player2" | "player3" | "player4", path: DigitalPath): DigitalBinding | undefined {
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system" | "sticks", string];
  // @ts-expect-error dynamic keying
  return p[playerKey]?.[group]?.[key];
}

export function clearDigital(p: ControlsProfile, playerKey: "player1" | "player2" | "player3" | "player4", path: DigitalPath): ControlsProfile {
  const next = structuredClone(p);
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system" | "sticks", string];
  // @ts-expect-error dynamic keying
  if (next[playerKey]?.[group]) delete next[playerKey][group][key];
  return next;
}

export function setGroupMode(p: ControlsProfile, playerKey: "player1" | "player2" | "player3" | "player4", group: "move" | "dpad" | "look", mode: "dpad" | "stick"): ControlsProfile {
  const next = structuredClone(p);
  if (!next[playerKey]) next[playerKey] = {} as any;
  if (!next[playerKey]) return next;
  const player = next[playerKey];

  if (group === "move") {
    player.move = mode === "dpad" ? defaultDpad() : defaultStick("left");
  } else if (group === "dpad") {
    player.dpad = defaultDpad();
  } else {
    player.look = mode === "dpad" ? defaultDpad() : defaultStick("right");
  }

  return next;
}

export function clearGroup(p: ControlsProfile, playerKey: "player1" | "player2" | "player3" | "player4", group: "move" | "dpad" | "look"): ControlsProfile {
  const next = structuredClone(p);
  const player = next[playerKey];

  if (group === "move") {
    player.move =
      player.move.type === "stick"
        ? { type: "stick", stick: player.move.stick, deadzone: player.move.deadzone }
        : { type: "dpad" };
  } else if (group === "dpad") {
    player.dpad = { type: "dpad" };
  } else {
    player.look =
      player.look.type === "stick"
        ? { type: "stick", stick: player.look.stick, deadzone: player.look.deadzone }
        : { type: "dpad" };
  }

  return next;
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

  if (!next[playerKey]) next[playerKey] = {} as any;
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
