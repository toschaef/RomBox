import { useCallback } from "react";
import type { DigitalBinding, DpadBinding, StickBinding } from "../../shared/types/controls";
import { axisToDigitalToken } from "../../shared/controls/gamepadTokens";

export function useControlsPressed(currentlyPressed: Set<string>) {
  const isDigitalPressed = useCallback(
    (d?: DigitalBinding): boolean => {
      if (!d) return false;
      if (d.type === "key") return currentlyPressed.has(d.code);
      if (d.type === "gp_button") return currentlyPressed.has(d.token);

      if (d.type === "gp_axis_digital") {
        const token = axisToDigitalToken({
          stick: d.stick,
          axis: d.axis,
          sign: d.dir === "neg" ? -1 : 1,
        });
        return currentlyPressed.has(token);
      }
      return false;
    },
    [currentlyPressed]
  );

  const isDpadPressed = useCallback(
    (dpad: DpadBinding): boolean => {
      return (
        isDigitalPressed(dpad.up) ||
        isDigitalPressed(dpad.down) ||
        isDigitalPressed(dpad.left) ||
        isDigitalPressed(dpad.right)
      );
    },
    [isDigitalPressed]
  );

  const isStickPressed = useCallback(
    (stick: StickBinding): boolean => {
      const left  = axisToDigitalToken({ stick: stick.stick, axis: "x", sign: -1 });
      const right = axisToDigitalToken({ stick: stick.stick, axis: "x", sign:  1 });
      const up    = axisToDigitalToken({ stick: stick.stick, axis: "y", sign: -1 });
      const down  = axisToDigitalToken({ stick: stick.stick, axis: "y", sign:  1 });

      return currentlyPressed.has(left) || currentlyPressed.has(right) || currentlyPressed.has(up) || currentlyPressed.has(down);
    },
    [currentlyPressed]
  );

  return { isDigitalPressed, isDpadPressed, isStickPressed };
}
