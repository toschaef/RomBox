import type { ControlsProfile, DigitalBinding, DpadBinding, StickBinding } from "../../shared/types/controls";
import type { GamepadToken } from "../../shared/controls/gamepadTokens";

export type InputEvent =
  | { kind: "key"; code: string; at: number }
  | { kind: "gp_button"; token: GamepadToken; at: number }
  | { kind: "gp_axis"; stick: "left" | "right"; axis: "x" | "y"; value: number; at: number };

export type BindPlan =
  | { kind: "digital"; path: "face.primary" | "face.secondary" | "face.tertiary" | "face.quaternary" | "shoulders.bumperL" | "shoulders.bumperR" | "shoulders.triggerL" | "shoulders.triggerR" | "system.start" | "system.select" }
  | { kind: "dpad"; group: "move" | "dpad" | "look" }
  | { kind: "stick"; group: "move" | "look"; stick: "left" | "right" };

export type BindState =
  | { active: false }
  | { active: true; plan: BindPlan; step: number; startedAt: number };

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

function setDigital(profile: ControlsProfile, path: BindPlan & { kind: "digital" }, value: DigitalBinding): ControlsProfile {
  const p = structuredClone(profile);
  const [group, key] = path.path.split(".") as ["face" | "shoulders" | "system", string];
  // @ts-expect-error T_T
  p.player1[group][key] = value;
  return p;
}

function setGroupDpad(profile: ControlsProfile, group: "move" | "dpad" | "look", next: DpadBinding): ControlsProfile {
  const p = structuredClone(profile);
  if (group === "move") p.player1.move = next;
  else if (group === "dpad") p.player1.dpad = next;
  else p.player1.look = next;
  return p;
}

function setGroupStick(profile: ControlsProfile, group: "move" | "look", next: StickBinding): ControlsProfile {
  const p = structuredClone(profile);
  if (group === "move") p.player1.move = next;
  else p.player1.look = next;
  return p;
}

export function bindLabel(state: BindState): string {
  if (!state.active) return "";
  const { plan, step } = state;
  if (plan.kind === "digital") return plan.path;
  if (plan.kind === "dpad") return `${plan.group.toUpperCase()} ${["UP","DOWN","LEFT","RIGHT"][step] ?? ""}`.trim();
  if (plan.kind === "stick") return `${plan.group.toUpperCase()} STICK ${step === 0 ? "X" : "Y"}`;
  return "";
}

export function applyBindEvent(profile: ControlsProfile, state: BindState, e: InputEvent): { profile: ControlsProfile; state: BindState } | null {
  if (!state.active) return null;
  if (e.at <= state.startedAt) return null;

  if (e.kind === "key" && e.code === "Escape") {
    return { profile, state: { active: false } };
  }

  const { plan, step } = state;

  if (plan.kind === "digital") {
    const d = digitalFromEvent(e);
    if (!d) return null;
    const nextProfile = setDigital(profile, plan, d);
    return { profile: nextProfile, state: { active: false } };
  }

  if (plan.kind === "dpad") {
    const d = digitalFromEvent(e);
    if (!d) return null;

    const current: DpadBinding =
      plan.group === "move"
        ? (profile.player1.move.type === "dpad" ? profile.player1.move : { type: "dpad" })
        : plan.group === "dpad"
          ? profile.player1.dpad
          : (profile.player1.look.type === "dpad" ? profile.player1.look : { type: "dpad" });

    const next: DpadBinding = structuredClone(current);

    if (step === 0) next.up = d;
    else if (step === 1) next.down = d;
    else if (step === 2) next.left = d;
    else if (step === 3) next.right = d;
    else return { profile, state: { active: false } };

    const nextProfile = setGroupDpad(profile, plan.group, next);

    const nextStep = step + 1;
    if (nextStep <= 3) return { profile: nextProfile, state: { ...state, step: nextStep } };
    return { profile: nextProfile, state: { active: false } };
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

    const nextProfile = setGroupStick(profile, plan.group, nextStick);

    const nextStep = step + 1;
    if (nextStep <= 1) return { profile: nextProfile, state: { ...state, step: nextStep } };
    return { profile: nextProfile, state: { active: false } };
  }

  return null;
}