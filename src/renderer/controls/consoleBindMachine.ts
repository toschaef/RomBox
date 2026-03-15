import type {
  AnyConsoleLayout,
  DigitalBinding,
  DpadBinding,
  StickBinding,
} from "../../shared/types/controls";
import type { GamepadToken } from "../../shared/controls/gamepadTokens";
import { setConsoleDigital } from "./consolePath";

export type InputEvent =
  | { kind: "key"; code: string; at: number }
  | { kind: "gp_button"; token: GamepadToken; at: number }
  | { kind: "gp_axis"; stick: "left" | "right"; axis: "x" | "y"; value: number; at: number };

export type BindPlanConsole =
  | { kind: "digital"; path: string }
  | { kind: "dpad"; group: "move" | "dpad" | "c" | "look" }
  | { kind: "stick"; group: "move" | "c" | "look"; stick: "left" | "right" };

export type BindState =
  | { active: false }
  | { active: true; plan: BindPlanConsole; step: number; startedAt: number };

export const AXIS_THRESHOLD = 0.65;

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

function setDigital(
  layout: AnyConsoleLayout,
  plan: Extract<BindPlanConsole, { kind: "digital" }>,
  value: DigitalBinding
): AnyConsoleLayout {
  return setConsoleDigital(layout, plan.path, value);
}

function setGroupDpad(layout: AnyConsoleLayout, group: "move" | "dpad" | "c" | "look", nextDpad: DpadBinding) {
  const next = structuredClone(layout);
  (next.bindings as any)[group] = nextDpad;
  return next;
}

function setGroupStick(layout: AnyConsoleLayout, group: "move" | "c" | "look", nextStick: StickBinding) {
  const next = structuredClone(layout);
  (next.bindings as any)[group] = nextStick;
  return next;
}

export function bindLabelConsole(state: BindState): string {
  if (!state.active) return "";
  const { plan, step } = state;
  if (plan.kind === "digital") return plan.path;
  if (plan.kind === "dpad") return `${plan.group.toUpperCase()} ${["UP","DOWN","LEFT","RIGHT"][step] ?? ""}`.trim();
  if (plan.kind === "stick") return `${plan.group.toUpperCase()} STICK ${step === 0 ? "X" : "Y"}`;
  return "";
}

export function applyBindEventConsole(
  layout: AnyConsoleLayout,
  state: BindState,
  e: InputEvent
): { layout: AnyConsoleLayout; state: BindState } | null {
  if (!state.active) return null;
  if (e.at <= state.startedAt) return null;

  if (e.kind === "key" && e.code === "Escape") {
    return { layout, state: { active: false } };
  }

  const { plan, step } = state;

  if (plan.kind === "digital") {
    const d = digitalFromEvent(e);
    if (!d) return null;
    const nextLayout = setDigital(layout, plan, d);
    return { layout: nextLayout, state: { active: false } };
  }

  if (plan.kind === "dpad") {
    const d = digitalFromEvent(e);
    if (!d) return null;

    const current: DpadBinding = ((layout.bindings)[plan.group]?.type === "dpad"
      ? (layout.bindings)[plan.group]
      : { type: "dpad" }) as DpadBinding;

    const next: DpadBinding = structuredClone(current);

    if (step === 0) next.up = d;
    else if (step === 1) next.down = d;
    else if (step === 2) next.left = d;
    else if (step === 3) next.right = d;
    else return { layout, state: { active: false } };

    const nextLayout = setGroupDpad(layout, plan.group, next);

    const nextStep = step + 1;
    if (nextStep <= 3) return { layout: nextLayout, state: { ...state, step: nextStep } };
    return { layout: nextLayout, state: { active: false } };
  }

  if (plan.kind === "stick") {
    if (e.kind !== "gp_axis") return null;
    if (Math.abs(e.value) < AXIS_THRESHOLD) return null;

    const axisWanted = step === 0 ? "x" : "y";
    if (e.axis !== axisWanted) return null;

    const nextStick: StickBinding = { type: "stick", stick: plan.stick, deadzone: 0.15 };
    const nextLayout = setGroupStick(layout, plan.group, nextStick);

    const nextStep = step + 1;
    if (nextStep <= 1) return { layout: nextLayout, state: { ...state, step: nextStep } };
    return { layout: nextLayout, state: { active: false } };
  }

  return null;
}