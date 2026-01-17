import { useCallback, useEffect, useMemo, useState } from "react";
import type { ControlsProfile, AnyConsoleLayout } from "../../shared/types/controls";
import { useControllerInput, type Detected } from "./useControllerInput";
import { applyBindEvent, bindLabel, type BindPlan, type BindState as StdBindState, type InputEvent } from "../controls/bindMachine";
import {
  applyBindEventConsole,
  bindLabelConsole,
  type BindPlanConsole,
  type BindState as ConsoleBindState,
} from "../controls/consoleBindMachine";

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
  const [stdState, setStdState] = useState<StdBindState>({ active: false });
  const [consoleState, setConsoleState] = useState<ConsoleBindState>({ active: false });

  const { lastDetectedInput, lastDetectedAt, clearLastDetectedInput, currentlyPressed } = useControllerInput();

  const startBind = useCallback(
    (plan: BindPlan | BindPlanConsole) => {
      clearLastDetectedInput();

      if (mode.kind === "standard") {
        setStdState({ active: true, plan: plan as any, step: 0, startedAt: performance.now() });
      } else {
        setConsoleState({ active: true, plan: plan as any, step: 0, startedAt: performance.now() });
      }
    },
    [mode.kind, clearLastDetectedInput]
  );

  const cancelBind = useCallback(() => {
    setStdState({ active: false });
    setConsoleState({ active: false });
    clearLastDetectedInput();
  }, [clearLastDetectedInput]);

  useEffect(() => {
    if (!lastDetectedInput || !lastDetectedAt) return;

    const e = toInputEvent(lastDetectedInput, lastDetectedAt);
    if (!e) return;

    if (mode.kind === "standard") {
      if (!stdState.active) return;
      const out = applyBindEvent(mode.profile, stdState, e);
      if (!out) return;

      mode.onChange(out.profile);
      setStdState(out.state);
      clearLastDetectedInput();
      return;
    }

    if (mode.kind === "console") {
      if (!consoleState.active) return;
      const out = applyBindEventConsole(mode.layout, consoleState, e);
      if (!out) return;

      mode.onChange(out.layout);
      setConsoleState(out.state);
      clearLastDetectedInput();
    }
  }, [
    mode,
    stdState,
    consoleState,
    lastDetectedInput,
    lastDetectedAt,
    clearLastDetectedInput,
  ]);

  const overlayLabel = useMemo(() => {
    if (mode.kind === "standard") return bindLabel(stdState);
    return bindLabelConsole(consoleState);
  }, [mode.kind, stdState, consoleState]);

  const bindStateActive = mode.kind === "standard" ? stdState.active : consoleState.active;

  return { bindStateActive, overlayLabel, currentlyPressed, startBind, cancelBind, stdState, consoleState };
}