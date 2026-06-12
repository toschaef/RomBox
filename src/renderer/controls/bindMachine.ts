import type { DigitalBinding, DpadBinding, StickBinding, ControlsProfile, AnyConsoleLayout } from "../../shared/types/controls";
import { AXIS_THRESHOLD, type InputEvent } from "../../shared/controls/inputTypes";
import { setConsoleDigital } from "./consolePath";

export { AXIS_THRESHOLD, type InputEvent } from "../../shared/controls/inputTypes";

/* ── Generic accessor pattern ───────────────────────────── */

export interface BindingAccessor<T> {
  setDigital(data: T, path: string, value: DigitalBinding): T;
  getDpad(data: T, group: string): DpadBinding;
  setDpad(data: T, group: string, dpad: DpadBinding): T;
  setStick(data: T, group: string, stick: StickBinding): T;
}

/* ── Profile accessor ───────────────────────────────────── */

export const profileAccessor: BindingAccessor<ControlsProfile> = {
  setDigital(profile, path, value) {
    const p = structuredClone(profile);
    const [group, key] = path.split(".") as ["face" | "shoulders" | "system" | "sticks", string];
    if (group === "sticks" && !p.player1.sticks) {
      p.player1.sticks = { type: "sticks" };
    }
    // @ts-expect-error dynamic keying into player1 binding groups
    p.player1[group][key] = value;
    return p;
  },

  getDpad(profile, group) {
    if (group === "move") {
      return profile.player1.move.type === "dpad" ? profile.player1.move : { type: "dpad" };
    }
    if (group === "dpad") return profile.player1.dpad;
    // "look"
    return profile.player1.look.type === "dpad" ? profile.player1.look : { type: "dpad" };
  },

  setDpad(profile, group, next) {
    const p = structuredClone(profile);
    if (group === "move") p.player1.move = next;
    else if (group === "dpad") p.player1.dpad = next;
    else p.player1.look = next;
    return p;
  },

  setStick(profile, group, next) {
    const p = structuredClone(profile);
    if (group === "move") p.player1.move = next;
    else p.player1.look = next;
    return p;
  },
};

/* ── Console layout accessor ────────────────────────────── */

export const consoleAccessor: BindingAccessor<AnyConsoleLayout> = {
  setDigital(layout, path, value) {
    return setConsoleDigital(layout, path, value);
  },

  getDpad(layout, group) {
    let v: unknown = layout.bindings;
    const parts = group.split(".");
    for (const part of parts) {
      v = (v && typeof v === "object") ? (v as Record<string, unknown>)[part] : undefined;
    }
    if (v && typeof v === "object" && (v as { type?: string }).type === "dpad") {
      return v as DpadBinding;
    }
    return { type: "dpad" };
  },

  setDpad(layout, group, nextDpad) {
    const next = structuredClone(layout);
    let parent = next.bindings as unknown as Record<string, unknown>;
    const parts = group.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!parent[part] || typeof parent[part] !== "object") {
        parent[part] = {};
      }
      parent = parent[part] as Record<string, unknown>;
    }
    parent[parts[parts.length - 1]] = nextDpad;
    return next;
  },

  setStick(layout, group, nextStick) {
    const next = structuredClone(layout);
    let parent = next.bindings as unknown as Record<string, unknown>;
    const parts = group.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!parent[part] || typeof parent[part] !== "object") {
        parent[part] = {};
      }
      parent = parent[part] as Record<string, unknown>;
    }
    parent[parts[parts.length - 1]] = nextStick;
    return next;
  },
};

/* ── Bind plans ─────────────────────────────────────────── */

export type BindPlan =
  | { kind: "digital"; path: string }
  | { kind: "dpad"; group: string }
  | { kind: "stick"; group: string; stick: "left" | "right" };

export type BindPlanConsole = BindPlan;

export type BindState =
  | { active: false }
  | { active: true; plan: BindPlan; step: number; startedAt: number };

/* ── Core functions ─────────────────────────────────────── */

function digitalFromEvent(e: InputEvent): DigitalBinding | null {
  if (e.kind === "key") return { type: "key", code: e.code };
  if (e.kind === "gp_button") return { type: "gp_button", token: e.token };
  if (e.kind === "gp_axis") {
    if (Math.abs(e.value) < AXIS_THRESHOLD) return null;
    return {
      type: "gp_axis_digital",
      stick: e.stick,
      axis: e.axis,
      dir: e.value < 0 ? "neg" : "pos",
      threshold: AXIS_THRESHOLD,
    };
  }
  return null;
}

export function bindLabel(state: BindState): string {
  if (!state.active) return "";
  const { plan, step } = state;
  if (plan.kind === "digital") return plan.path;
  if (plan.kind === "dpad") return `${plan.group.toUpperCase()} ${["UP", "DOWN", "LEFT", "RIGHT"][step] ?? ""}`.trim();
  if (plan.kind === "stick") return `${plan.group.toUpperCase()} STICK ${step === 0 ? "X" : "Y"}`;
  return "";
}

export function applyBindEvent<T>(
  accessor: BindingAccessor<T>,
  data: T,
  state: BindState,
  e: InputEvent
): { data: T; state: BindState } | null {
  if (!state.active) return null;
  if (e.at <= state.startedAt) return null;

  if (e.kind === "key" && e.code === "Escape") {
    return { data, state: { active: false } };
  }

  const { plan, step } = state;

  if (plan.kind === "digital") {
    const d = digitalFromEvent(e);
    if (!d) return null;
    const nextData = accessor.setDigital(data, plan.path, d);
    return { data: nextData, state: { active: false } };
  }

  if (plan.kind === "dpad") {
    const d = digitalFromEvent(e);
    if (!d) return null;

    const current: DpadBinding = accessor.getDpad(data, plan.group);
    const next: DpadBinding = structuredClone(current);

    if (step === 0) next.up = d;
    else if (step === 1) next.down = d;
    else if (step === 2) next.left = d;
    else if (step === 3) next.right = d;
    else return { data, state: { active: false } };

    const nextData = accessor.setDpad(data, plan.group, next);

    const nextStep = step + 1;
    if (nextStep <= 3) return { data: nextData, state: { ...state, step: nextStep } };
    return { data: nextData, state: { active: false } };
  }

  if (plan.kind === "stick") {
    if (e.kind !== "gp_axis") return null;
    if (Math.abs(e.value) < AXIS_THRESHOLD) return null;

    const axisWanted = step === 0 ? "x" : "y";
    if (e.axis !== axisWanted) return null;

    const nextStick: StickBinding = {
      type: "stick",
      stick: plan.stick,
      deadzone: 0.15,
    };

    const nextData = accessor.setStick(data, plan.group, nextStick);

    const nextStep = step + 1;
    if (nextStep <= 1) return { data: nextData, state: { ...state, step: nextStep } };
    return { data: nextData, state: { active: false } };
  }

  return null;
}