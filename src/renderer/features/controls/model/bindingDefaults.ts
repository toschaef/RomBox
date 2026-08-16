import type { DpadBinding, StickBinding } from "../../../../shared/types/controls";

export function defaultStick(stick: "left" | "right"): StickBinding {
  return { type: "stick", stick, deadzone: 0.15 };
}

export function defaultDpad(): DpadBinding {
  return { type: "dpad" };
}
