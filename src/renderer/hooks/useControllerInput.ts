import { useCallback, useEffect, useRef, useState } from "react";
import type { GamepadToken } from "../../shared/controls/gamepadTokens";
import { axisToDigitalToken } from "../../shared/controls/gamepadTokens";

const AXIS_THRESHOLD = 0.65;

export type Detected =
  | { device: "keyboard"; input: string }
  | { device: "gamepad"; kind: "button"; input: GamepadToken }
  | { device: "gamepad"; kind: "axis"; stick: "left" | "right"; axis: "x" | "y"; sign: 1 | -1 };

const BUTTON_NAME_MAP: Record<number, GamepadToken> = {
  0: "GP_A",
  1: "GP_B",
  2: "GP_X",
  3: "GP_Y",
  4: "GP_L1",
  5: "GP_R1",
  6: "GP_L2",
  7: "GP_R2",
  8: "GP_SELECT",
  9: "GP_START",
  10: "GP_L3",
  11: "GP_R3",
  12: "GP_DPAD_UP",
  13: "GP_DPAD_DOWN",
  14: "GP_DPAD_LEFT",
  15: "GP_DPAD_RIGHT",
};

function isAxisDetected(d: Detected): d is Extract<Detected, { device: "gamepad"; kind: "axis" }> {
  return d.device === "gamepad" && d.kind === "axis";
}

function axisMetaFromIndex(idx: number): { stick: "left" | "right"; axis: "x" | "y" } {
  const stick: "left" | "right" = idx < 2 ? "left" : "right";
  const axis: "x" | "y" = idx % 2 === 0 ? "x" : "y";
  return { stick, axis };
}

function axisDetected(idx: number, value: number): Detected | null {
  if (Math.abs(value) < AXIS_THRESHOLD) return null;
  const { stick, axis } = axisMetaFromIndex(idx);
  const sign: 1 | -1 = value > 0 ? 1 : -1;
  return { device: "gamepad", kind: "axis", stick, axis, sign };
}

export function useControllerInput() {
  const [currentlyPressed, setCurrentlyPressed] = useState<Set<string>>(new Set());
  const [lastDetected, setLastDetected] = useState<{ input: Detected; at: number } | null>(null);

  const keyboardDown = useRef(new Set<string>());
  const prevPressed = useRef(new Set<string>());

  const prevAxisToken = useRef(new Map<number, GamepadToken>());

  const rafId = useRef<number>(0);

  const clearLastDetectedInput = useCallback(() => setLastDetected(null), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (keyboardDown.current.has(e.code)) return;
      keyboardDown.current.add(e.code);

      setLastDetected({ input: { device: "keyboard", input: e.code }, at: performance.now() });

      setCurrentlyPressed((prev) => {
        const next = new Set(prev);
        next.add(e.code);
        return next;
      });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keyboardDown.current.delete(e.code);
      setCurrentlyPressed((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const gp = pads.find((p) => p && p.connected) ?? null;

      const nextPressed = new Set<string>(keyboardDown.current);
      let detectedThisFrame: Detected | null = null;

      if (gp) {
        // buttons (pressed + rising edge detection)
        for (let i = 0; i < gp.buttons.length; i++) {
          if (!gp.buttons[i]?.pressed) continue;

          const token = BUTTON_NAME_MAP[i];
          if (!token) continue;

          nextPressed.add(token);

          if (!detectedThisFrame && !prevPressed.current.has(token)) {
            detectedThisFrame = { device: "gamepad", kind: "button", input: token };
          }
        }

        // axes (pressed + threshold crossing detection)
        for (let i = 0; i < gp.axes.length; i++) {
          const value = gp.axes[i];
          const d = axisDetected(i, value);

          if (!d) {
            prevAxisToken.current.delete(i);
            continue;
          }

          if (!isAxisDetected(d)) continue;

          const token = axisToDigitalToken({ stick: d.stick, axis: d.axis, sign: d.sign });
          nextPressed.add(token);

          const prevTok = prevAxisToken.current.get(i);
          if (!prevTok || prevTok !== token) {
            prevAxisToken.current.set(i, token);
            if (!detectedThisFrame) detectedThisFrame = d;
          }
        }
      } else {
        prevAxisToken.current.clear();
      }

      setCurrentlyPressed(nextPressed);

      if (detectedThisFrame) {
        setLastDetected({ input: detectedThisFrame, at: performance.now() });
      }

      prevPressed.current = nextPressed;
      rafId.current = requestAnimationFrame(poll);
    };

    rafId.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return {
    currentlyPressed,
    lastDetectedInput: lastDetected?.input ?? null,
    lastDetectedAt: lastDetected?.at ?? null,
    clearLastDetectedInput,
  };
}