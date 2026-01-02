import { useCallback, useEffect, useMemo, useState } from "react";
import type { ControlsProfile } from "../../shared/controls/types";
import { applyBindEvent, bindLabel, type BindPlan, type BindState, type InputEvent } from "../controls/bindMachine";
import { useControllerInput, type Detected } from "./useControllerInput";

function toInputEvent(d: Detected, at: number): InputEvent | null {
  if (d.device === "keyboard") return { kind: "key", code: d.input, at };
  if (d.device === "gamepad" && d.kind === "button") return { kind: "gp_button", token: d.input, at };
  if (d.device === "gamepad" && d.kind === "axis") {
    const value = d.sign === -1 ? -1 : 1;
    return { kind: "gp_axis", stick: d.stick, axis: d.axis, value, at };
  }
  return null;
}

export function useControlsBinding(args: {
  profile: ControlsProfile | null;
  onProfileChange: (next: ControlsProfile) => void;
}) {
  const { profile, onProfileChange } = args;
  const [bindState, setBindState] = useState<BindState>({ active: false });

  const { lastDetectedInput, lastDetectedAt, clearLastDetectedInput, currentlyPressed } = useControllerInput();

  const startBind = useCallback((plan: BindPlan) => {
    clearLastDetectedInput();
    setBindState({ active: true, plan, step: 0, startedAt: performance.now() });
  }, [clearLastDetectedInput]);

  const cancelBind = useCallback(() => {
    setBindState({ active: false });
    clearLastDetectedInput();
  }, [clearLastDetectedInput]);

  useEffect(() => {
    if (!profile) return;
    if (!bindState.active) return;
    if (!lastDetectedInput || !lastDetectedAt) return;

    const e = toInputEvent(lastDetectedInput, lastDetectedAt);
    if (!e) return;

    const out = applyBindEvent(profile, bindState, e);
    if (!out) return;

    onProfileChange(out.profile);
    setBindState(out.state);
    clearLastDetectedInput();
  }, [profile, bindState, lastDetectedInput, lastDetectedAt, onProfileChange, clearLastDetectedInput]);

  const overlayLabel = useMemo(() => bindLabel(bindState), [bindState]);

  return { bindState, overlayLabel, currentlyPressed, startBind, cancelBind };
}