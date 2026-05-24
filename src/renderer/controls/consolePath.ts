import type { AnyConsoleLayout, DigitalBinding } from "../../shared/types/controls";

export function getConsoleDigital(layout: AnyConsoleLayout, id: string): DigitalBinding | undefined {
  const b = (layout as unknown as { bindings?: Record<string, unknown> }).bindings ?? {};

  if (!id.includes(".")) {
    const v = b[id];
    return isDigital(v) ? (v as DigitalBinding) : undefined;
  }

  const [group, key] = id.split(".", 2);
  const groupObj = b[group];
  const v = groupObj && typeof groupObj === "object" ? (groupObj as Record<string, unknown>)[key] : undefined;
  return isDigital(v) ? (v as DigitalBinding) : undefined;
}

export function setConsoleDigital(layout: AnyConsoleLayout, id: string, value: DigitalBinding): AnyConsoleLayout {
  const next = structuredClone(layout) as unknown as {
    bindings: Record<string, unknown>;
  };
  next.bindings ??= {};

  if (!id.includes(".")) {
    next.bindings[id] = value;
    return next as unknown as AnyConsoleLayout;
  }

  const [group, key] = id.split(".", 2);
  if (!next.bindings[group] || typeof next.bindings[group] !== "object") {
    next.bindings[group] = {};
  }
  (next.bindings[group] as Record<string, unknown>)[key] = value;
  return next as unknown as AnyConsoleLayout;
}

export function clearConsoleDigital(layout: AnyConsoleLayout, id: string): AnyConsoleLayout {
  const next = structuredClone(layout) as unknown as {
    bindings: Record<string, unknown>;
  };
  next.bindings ??= {};

  if (!id.includes(".")) {
    delete next.bindings[id];
    return next as unknown as AnyConsoleLayout;
  }

  const [group, key] = id.split(".", 2);
  const groupObj = next.bindings[group];
  if (groupObj && typeof groupObj === "object") {
    delete (groupObj as Record<string, unknown>)[key];
  }
  return next as unknown as AnyConsoleLayout;
}

function isDigital(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const type = (v as Record<string, unknown>).type;
  return type === "key" || type === "gp_button" || type === "gp_axis_digital";
}