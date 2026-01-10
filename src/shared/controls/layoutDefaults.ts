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
      move: { type: "dpad" },
      dpad: { type: "dpad" },
      look: { type: "stick", stick: "right", deadzone: 0.15 },
      face: { type: "face" },
      shoulders: { type: "shoulders" },
      system: { type: "system" },
    },
  };
}