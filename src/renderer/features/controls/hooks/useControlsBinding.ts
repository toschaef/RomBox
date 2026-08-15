import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ControlsProfile, AnyConsoleLayout } from "../../../../shared/types/controls";
import { useControllerInput, type Detected } from "./useControllerInput";
import {
  applyBindEvent,
  bindLabel,
  plansEqual,
  profileAccessor,
  consoleAccessor,
  type BindPlan,
  type BindState,
  type InputEvent,
} from "../model/bindMachine";

function toInputEvent(d: Detected, at: number): InputEvent | null {
  if (d.device === "keyboard") return { kind: "key", code: d.input, at };
  if (d.device === "gamepad" && d.kind === "button") return { kind: "gp_button", token: d.input, at };
  if (d.device === "gamepad" && d.kind === "axis") {
    const value = d.sign === -1 ? -1 : 1;
    return { kind: "gp_axis", stick: d.stick, axis: d.axis, value, at };
  }
  return null;
}

type Mode =
  | { kind: "standard"; profile: ControlsProfile; onChange: (p: ControlsProfile) => void }
  | { kind: "console"; layout: AnyConsoleLayout; onChange: (l: AnyConsoleLayout) => void };

export function useControlsBinding(mode: Mode, options?: { inputPaused?: boolean }) {
  const inputPaused = options?.inputPaused ?? false;

  const [bindState, setBindState] = useState<BindState>({ active: false });

  const { lastDetectedInput, lastDetectedAt, clearLastDetectedInput, currentlyPressed } = useControllerInput({
    paused: inputPaused,
  });

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const startBind = useCallback(
    (plan: BindPlan, playerKey: "player1" | "player2" | "player3" | "player4") => {
      clearLastDetectedInput();
      setBindState({ active: true, playerKey, plan, step: 0, startedAt: performance.now() });
    },
    [clearLastDetectedInput]
  );

  const cancelBind = useCallback(() => {
    setBindState({ active: false });
    clearLastDetectedInput();
  }, [clearLastDetectedInput]);

  // pausing input drops any in-progress bind, otherwise the overlay hangs
  useEffect(() => {
    if (inputPaused) setBindState({ active: false });
  }, [inputPaused]);

  useEffect(() => {
    if (inputPaused) return;
    if (!lastDetectedInput || !lastDetectedAt) return;
    if (!bindState.active) return;

    const e = toInputEvent(lastDetectedInput, lastDetectedAt);
    if (!e) return;

    const currentMode = modeRef.current;

    if (currentMode.kind === "standard") {
      const out = applyBindEvent(profileAccessor, currentMode.profile, bindState, e);
      if (!out) return;
      currentMode.onChange(out.data);
      setBindState(out.state);
      clearLastDetectedInput();
      return;
    }

    if (currentMode.kind === "console") {
      const out = applyBindEvent(consoleAccessor, currentMode.layout, bindState, e);
      if (!out) return;
      currentMode.onChange(out.data);
      setBindState(out.state);
      clearLastDetectedInput();
    }
  }, [bindState, lastDetectedInput, lastDetectedAt, clearLastDetectedInput, inputPaused]);

  const overlayLabel = useMemo(() => bindLabel(bindState), [bindState]);

  const planEquals = useCallback(
    (plan: BindPlan) => (bindState.active ? plansEqual(bindState.plan, plan) : false),
    [bindState]
  );

  return {
    bindStateActive: bindState.active,
    overlayLabel,
    currentlyPressed,
    startBind,
    cancelBind,
    bindState,
    planEquals,
  };
}