import type { ConsoleID } from "../types";
import type { ControlsProfile, PlayerBindings } from "../types/controls";

export function makeDefaultConsoleBindings(consoleId: ConsoleID, profile: ControlsProfile): PlayerBindings {
  const p1 = profile.player1;

  const common: PlayerBindings = {
    move: p1.move,
    dpad: p1.dpad,
    look: p1.look,
    face: p1.face,
    shoulders: p1.shoulders,
    system: p1.system,
    sticks: p1.sticks,
    special: p1.special,
  };

  if (consoleId === "n64") {
    return common;
  }

  return common;
}

export function createDefaultProfileShape(): Omit<
  ControlsProfile,
  "id" | "name" | "createdAt" | "updatedAt" | "isDefault"
> {
  return {
    preferredDevice: "auto",
    player1: {
      move: {
        type: "dpad",
        up: { type: "key", code: "KeyW" },
        down: { type: "key", code: "KeyS" },
        left: { type: "key", code: "KeyA" },
        right: { type: "key", code: "KeyD" },
      },
      dpad: {
        type: "dpad",
        up: { type: "key", code: "Digit3" },
        down: { type: "key", code: "Digit2" },
        left: { type: "key", code: "Digit1" },
        right: { type: "key", code: "Digit4" },
      },
      look: {
        type: "dpad",
        up: { type: "key", code: "ArrowUp" },
        down: { type: "key", code: "ArrowDown" },
        left: { type: "key", code: "ArrowLeft" },
        right: { type: "key", code: "ArrowRight" },
      },
      face: {
        type: "face",
        primary: { type: "key", code: "KeyU" },
        secondary: { type: "key", code: "KeyI" },
        tertiary: { type: "key", code: "KeyO" },
        quaternary: { type: "key", code: "KeyP" },
      },
      shoulders: {
        type: "shoulders",
        triggerL: { type: "key", code: "Digit7" },
        bumperL: { type: "key", code: "Digit8" },
        bumperR: { type: "key", code: "Digit9" },
        triggerR: { type: "key", code: "Digit0" },
      },
      system: {
        type: "system",
        start: { type: "key", code: "KeyT" },
        select: { type: "key", code: "KeyY" },
      },
      sticks: {
        type: "sticks",
        l3: { type: "key", code: "KeyJ" },
        r3: { type: "key", code: "KeyK" },
      },
    },
  };
}