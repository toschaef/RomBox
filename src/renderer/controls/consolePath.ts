import type { AnyConsoleLayout, DigitalBinding } from "../../shared/types/controls";


export function getConsoleDigital(layout: AnyConsoleLayout, id: string): DigitalBinding | undefined {
  const b: any = (layout as any).bindings ?? {};

  if (!id.includes(".")) {
    const v = b[id];
    return isDigital(v) ? (v as DigitalBinding) : undefined;
  }

  const [group, key] = id.split(".", 2);
  const v = b?.[group]?.[key];
  return isDigital(v) ? (v as DigitalBinding) : undefined;
}

export function setConsoleDigital(layout: AnyConsoleLayout, id: string, value: DigitalBinding): AnyConsoleLayout {
  const next: any = structuredClone(layout);
  next.bindings ??= {};

  if (!id.includes(".")) {
    next.bindings[id] = value;
    return next as AnyConsoleLayout;
  }

  const [group, key] = id.split(".", 2);
  next.bindings[group] ??= {};
  next.bindings[group][key] = value;
  return next as AnyConsoleLayout;
}

export function clearConsoleDigital(layout: AnyConsoleLayout, id: string): AnyConsoleLayout {
  const next: any = structuredClone(layout);
  next.bindings ??= {};

  if (!id.includes(".")) {
    delete next.bindings[id];
    return next as AnyConsoleLayout;
  }

  const [group, key] = id.split(".", 2);
  if (next.bindings[group]) delete next.bindings[group][key];
  return next as AnyConsoleLayout;
}

function isDigital(v: any): boolean {
  return v && typeof v === "object" && (
    v.type === "key" ||
    v.type === "gp_button" ||
    v.type === "gp_axis_digital"
  );
}