import type { Platform } from "../../../shared/types";
import type { ActionBindings, PhysicalBinding } from "../../../shared/types/controls";

export type EmulatorPatch =
  | { kind: "json-merge"; path: string[]; value: unknown }
  | { kind: "json-set"; path: string[]; value: unknown }
  | { kind: "ini-set"; section: string; key: string; value: string }
  | { kind: "ini-delete"; section: string; key: string };

export interface TranslateContext {
  platform: Platform;
  player?: number;
  padPort?: number;
}

export interface IEmulatorTranslator {
  id: string;
  platform?: Platform;

  /** returns translated keybind for configurator */
  translate(bindings: ActionBindings, ctx: TranslateContext): EmulatorPatch[];
}

/** maps and returns first keybind in arr */
export function firstMapped<T>(arr: PhysicalBinding[], mapFn: (b: PhysicalBinding) => T | null): T | null {
  for (const b of arr) {
    const v = mapFn(b);
    if (v !== null) return v;
  }
  return null;
}
