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

export type ConsoleGroupId = "move" | "dpad" | "look" | "special.c" | "special";

export function defaultStick(stick: "left" | "right"): StickBinding {
  return { type: "stick", stick, deadzone: 0.15 };
}

export function defaultDpad(): DpadBinding {
  return { type: "dpad" };
}

export function getDigital(p: ControlsProfile, path: DigitalPath): DigitalBinding | undefined {
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system" | "sticks", string];
  // @ts-expect-error dynamic keying
  return p.player1[group]?.[key];
}

export function clearDigital(p: ControlsProfile, path: DigitalPath): ControlsProfile {
  const next = structuredClone(p);
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system" | "sticks", string];
  // @ts-expect-error dynamic keying
  if (next.player1[group]) delete next.player1[group][key];
  return next;
}

export function setGroupMode(p: ControlsProfile, group: "move" | "dpad" | "look", mode: "dpad" | "stick"): ControlsProfile {
  const next = structuredClone(p);

  if (group === "move") {
    next.player1.move = mode === "dpad" ? defaultDpad() : defaultStick("left");
  } else if (group === "dpad") {
    next.player1.dpad = defaultDpad();
  } else {
    next.player1.look = mode === "dpad" ? defaultDpad() : defaultStick("right");
  }

  return next;
}

export function clearGroup(p: ControlsProfile, group: "move" | "dpad" | "look"): ControlsProfile {
  const next = structuredClone(p);

  if (group === "move") {
    next.player1.move =
      next.player1.move.type === "stick"
        ? { type: "stick", stick: next.player1.move.stick, deadzone: next.player1.move.deadzone }
        : { type: "dpad" };
  } else if (group === "dpad") {
    next.player1.dpad = { type: "dpad" };
  } else {
    next.player1.look =
      next.player1.look.type === "stick"
        ? { type: "stick", stick: next.player1.look.stick, deadzone: next.player1.look.deadzone }
        : { type: "dpad" };
  }

  return next;
}

export function getConsoleGroupValue(layout: AnyConsoleLayout, group: ConsoleGroupId): DpadBinding | StickBinding {
  const b = layout.bindings as Record<string, unknown>;
  const parts = group.split(".");
  let v: unknown = b;
  for (const part of parts) {
    v = (v && typeof v === "object") ? (v as Record<string, unknown>)[part] : undefined;
  }

  const typedV = v as { type?: string } | null;
  if (typedV && typeof typedV === "object" && (typedV.type === "dpad" || typedV.type === "stick")) {
    return typedV as DpadBinding | StickBinding;
  }

  if (group === "move") return defaultDpad();
  if (group === "dpad") return defaultDpad();
  return defaultDpad();
}

export function setConsoleGroupMode(layout: AnyConsoleLayout, group: ConsoleGroupId, mode: "dpad" | "stick"): AnyConsoleLayout {
  const next = structuredClone(layout);

  const stick: "left" | "right" = (group === "special.c" || group === "look") ? "right" : "left";
  const val = mode === "dpad" ? defaultDpad() : defaultStick(stick);

  let parent: Record<string, unknown> = next.bindings as unknown as Record<string, unknown>;
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

export function clearConsoleGroup(layout: AnyConsoleLayout, group: ConsoleGroupId): AnyConsoleLayout {
  const next = structuredClone(layout);

  let parent: Record<string, unknown> = next.bindings as unknown as Record<string, unknown>;
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
