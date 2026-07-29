import type { DigitalBinding, DpadBinding, StickBinding, ControlsProfile, AnyConsoleLayout } from "../../shared/types/controls";
import { AXIS_THRESHOLD, type InputEvent } from "../../shared/controls/inputTypes";
import { setConsoleDigital } from "./consolePath";

export { AXIS_THRESHOLD, type InputEvent } from "../../shared/controls/inputTypes";

// generic accessor pattern

export type PlayerKey = "player1" | "player2" | "player3" | "player4";

export interface BindingAccessor<T> {
  setDigital(data: T, playerKey: PlayerKey, path: string, value: DigitalBinding): T;
  getDpad(data: T, playerKey: PlayerKey, group: string): DpadBinding;
  setDpad(data: T, playerKey: PlayerKey, group: string, dpad: DpadBinding): T;
  setStick(data: T, playerKey: PlayerKey, group: string, stick: StickBinding): T;
}

// profile accessor

export const profileAccessor: BindingAccessor<ControlsProfile> = {
  setDigital(profile, playerKey, path, value) {
    const p = structuredClone(profile);
    const [group, key] = path.split(".") as ["face" | "shoulders" | "system" | "sticks", string];
    if (!p[playerKey]) p[playerKey] = {} as any;
    if (group === "sticks" && !p[playerKey]!.sticks) {
      p[playerKey]!.sticks = { type: "sticks" };
    }
    if (!p[playerKey]![group]) {
      p[playerKey]![group] = { type: group } as any;
    }
    // @ts-expect-error dynamic keying
    p[playerKey]![group][key] = value;
    return p;
  },

  getDpad(profile, playerKey, group) {
    const player = profile[playerKey];
    if (!player) return { type: "dpad" };
    if (group === "move") {
      return player.move?.type === "dpad" ? player.move : { type: "dpad" };
    }
    if (group === "dpad") return player.dpad ?? { type: "dpad" };
    return player.look?.type === "dpad" ? player.look : { type: "dpad" };
  },

  setDpad(profile, playerKey, group, next) {
    const p = structuredClone(profile);
    if (!p[playerKey]) p[playerKey] = {} as any;
    if (group === "move") p[playerKey]!.move = next;
    else if (group === "dpad") p[playerKey]!.dpad = next;
    else p[playerKey]!.look = next;
    return p;
  },

  setStick(profile, playerKey, group, next) {
    const p = structuredClone(profile);
    if (!p[playerKey]) p[playerKey] = {} as any;
    if (group === "move") p[playerKey]!.move = next;
    else p[playerKey]!.look = next;
    return p;
  },
};

// console layout accessor

function setConsoleNestedBinding(layout: AnyConsoleLayout, playerKey: PlayerKey, group: string, value: DpadBinding | StickBinding): AnyConsoleLayout {
  const next = structuredClone(layout);
  if (!next[playerKey]) next[playerKey] = {} as any;
  let parent = next[playerKey] as unknown as Record<string, unknown>;
  const parts = group.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!parent[part] || typeof parent[part] !== "object") {
      parent[part] = {};
    }
    parent = parent[part] as Record<string, unknown>;
  }
  parent[parts[parts.length - 1]] = value;
  return next;
}

export const consoleAccessor: BindingAccessor<AnyConsoleLayout> = {
  setDigital(layout, playerKey, path, value) {
    return setConsoleDigital(layout, playerKey, path, value);
  },

  getDpad(layout, playerKey, group) {
    let v: unknown = layout[playerKey];
    if (!v) return { type: "dpad" };
    const parts = group.split(".");
    for (const part of parts) {
      v = (v && typeof v === "object") ? (v as Record<string, unknown>)[part] : undefined;
    }
    if (v && typeof v === "object" && (v as { type?: string }).type === "dpad") {
      return v as DpadBinding;
    }
    return { type: "dpad" };
  },

  setDpad(layout, playerKey, group, nextDpad) {
    return setConsoleNestedBinding(layout, playerKey, group, nextDpad);
  },

  setStick(layout, playerKey, group, nextStick) {
    return setConsoleNestedBinding(layout, playerKey, group, nextStick);
  },
};

// binf plans

export type BindPlan =
  | { kind: "digital"; path: string }
  | { kind: "dpad"; group: string }
  | { kind: "stick"; group: string; stick: "left" | "right" };

export type BindPlanConsole = BindPlan;

export type BindState =
  | { active: false }
  | { active: true; playerKey: PlayerKey; plan: BindPlan; step: number; startedAt: number };

// core functions

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

  if (plan.kind === "digital" || plan.kind === "dpad") {
    const d = digitalFromEvent(e);
    if (!d) return null;

    if (plan.kind === "digital") {
      const nextData = accessor.setDigital(data, state.playerKey, plan.path, d);
      return { data: nextData, state: { active: false } };
    } else {
      const current: DpadBinding = accessor.getDpad(data, state.playerKey, plan.group);
      const next: DpadBinding = structuredClone(current);

      if (step === 0) next.up = d;
      else if (step === 1) next.down = d;
      else if (step === 2) next.left = d;
      else if (step === 3) next.right = d;
      else return { data, state: { active: false } };

      const nextData = accessor.setDpad(data, state.playerKey, plan.group, next);

      const nextStep = step + 1;
      if (nextStep <= 3) return { data: nextData, state: { ...state, step: nextStep } };
      return { data: nextData, state: { active: false } };
    }
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

    const nextData = accessor.setStick(data, state.playerKey, plan.group, nextStick);

    const nextStep = step + 1;
    if (nextStep <= 1) return { data: nextData, state: { ...state, step: nextStep } };
    return { data: nextData, state: { active: false } };
  }

  return null;
}