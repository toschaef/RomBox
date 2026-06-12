import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ControlsProfile, AnyConsoleLayout } from "../../shared/types/controls";
import { useControllerInput, type Detected } from "./useControllerInput";
import {
  applyBindEvent,
  bindLabel,
  profileAccessor,
  consoleAccessor,
  type BindPlan,
  type BindState,
  type InputEvent,
} from "../controls/bindMachine";

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

export function useControlsBinding(mode: Mode) {
  const [bindState, setBindState] = useState<BindState>({ active: false });

  const { lastDetectedInput, lastDetectedAt, clearLastDetectedInput, currentlyPressed } = useControllerInput();

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const startBind = useCallback(
    (plan: BindPlan) => {
      clearLastDetectedInput();
      setBindState({ active: true, plan, step: 0, startedAt: performance.now() });
    },
    [clearLastDetectedInput]
  );

  const cancelBind = useCallback(() => {
    setBindState({ active: false });
    clearLastDetectedInput();
  }, [clearLastDetectedInput]);

  useEffect(() => {
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
  }, [bindState, lastDetectedInput, lastDetectedAt, clearLastDetectedInput]);

  const overlayLabel = useMemo(() => bindLabel(bindState), [bindState]);

  return {
    bindStateActive: bindState.active,
    overlayLabel,
    currentlyPressed,
    startBind,
    cancelBind,
    bindState,
    stdState: bindState,
    consoleState: bindState,
  };
}