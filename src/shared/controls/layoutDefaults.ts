import type { ConsoleID } from "../types";
import type { ControlsProfile, PlayerBindings } from "./types";

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