import { useCallback, useEffect, useRef, useState } from "react";
import { PhysicalBinding } from "../../shared/types/controls";

const AXIS_THRESHOLD = 0.65;

const BUTTON_NAME_MAP: Record<number, string> = {
  0: "GP_BTN_A",
  1: "GP_BTN_B",
  2: "GP_BTN_X",
  3: "GP_BTN_Y",
  4: "GP_BTN_LB",
  5: "GP_BTN_RB",
  6: "GP_BTN_LT",
  7: "GP_BTN_RT",
  8: "GP_BTN_BACK",
  9: "GP_BTN_START",
  10: "GP_BTN_LS",
  11: "GP_BTN_RS",
  12: "GP_DPAD_UP",
  13: "GP_DPAD_DOWN",
  14: "GP_DPAD_LEFT",
  15: "GP_DPAD_RIGHT",
};

function areSetsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

export function useControllerInput() {
  const [currentlyPressed, setCurrentlyPressed] = useState<Set<string>>(new Set());
  const [lastDetected, setLastDetected] = useState<{ binding: PhysicalBinding; at: number } | null>(null);

  const keyboardState = useRef<Set<string>>(new Set());
  const rafId = useRef<number>(0);

  const clearLastDetectedInput = useCallback(() => {
    setLastDetected(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (keyboardState.current.has(e.code)) return;
      
      keyboardState.current.add(e.code);
      setLastDetected({
        binding: { device: "keyboard", input: e.code },
        at: performance.now(),
      });

      setCurrentlyPressed(new Set(keyboardState.current));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keyboardState.current.delete(e.code);
      setCurrentlyPressed(new Set(keyboardState.current));
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const gp = pads.find((p) => p && p.connected);

      const nextFramePressed = new Set(keyboardState.current);
      let foundGamepadInput: string | null = null;

      if (gp) {
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed) {
            const name = BUTTON_NAME_MAP[idx] ?? `GP_BTN_${idx}`;
            nextFramePressed.add(name);
            if (!foundGamepadInput) foundGamepadInput = name;
          }
        });

        const [ax0, ax1] = gp.axes;
        
        if (ax1 < -AXIS_THRESHOLD) { nextFramePressed.add("GP_LS_UP"); if(!foundGamepadInput) foundGamepadInput = "GP_LS_UP"; }
        if (ax1 > AXIS_THRESHOLD) { nextFramePressed.add("GP_LS_DOWN"); if(!foundGamepadInput) foundGamepadInput = "GP_LS_DOWN"; }
        if (ax0 < -AXIS_THRESHOLD) { nextFramePressed.add("GP_LS_LEFT"); if(!foundGamepadInput) foundGamepadInput = "GP_LS_LEFT"; }
        if (ax0 > AXIS_THRESHOLD) { nextFramePressed.add("GP_LS_RIGHT"); if(!foundGamepadInput) foundGamepadInput = "GP_LS_RIGHT"; }
      }

      setCurrentlyPressed((prev) => {
        if (areSetsEqual(prev, nextFramePressed)) return prev;
        return nextFramePressed;
      });

      if (foundGamepadInput) {
        setLastDetected({
            binding: { device: "gamepad", input: foundGamepadInput },
            at: performance.now()
        });
      }

      rafId.current = requestAnimationFrame(poll);
    };

    rafId.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return {
    currentlyPressed,
    lastDetectedInput: lastDetected?.binding ?? null,
    lastDetectedAt: lastDetected?.at ?? null,
    clearLastDetectedInput,
  };
}