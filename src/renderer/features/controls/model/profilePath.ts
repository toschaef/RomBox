import type { ControlsProfile, DigitalBinding, PlayerBindings } from "../../../../shared/types/controls";
import { defaultDpad, defaultStick } from "./bindingDefaults";

export type DigitalPath =
  | "face.primary"
  | "face.secondary"
  | "face.tertiary"
  | "face.quaternary"
  | "shoulders.bumperL"
  | "shoulders.bumperR"
  | "shoulders.triggerL"
  | "shoulders.triggerR"
  | "sticks.l3"
  | "sticks.r3"
  | "system.start"
  | "system.select";

export function getDigital(p: ControlsProfile, playerKey: "player1" | "player2" | "player3" | "player4", path: DigitalPath): DigitalBinding | undefined {
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system" | "sticks", string];
  // @ts-expect-error dynamic keying
  return p[playerKey]?.[group]?.[key];
}

export function clearDigital(p: ControlsProfile, playerKey: "player1" | "player2" | "player3" | "player4", path: DigitalPath): ControlsProfile {
  const next = structuredClone(p);
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system" | "sticks", string];
  // @ts-expect-error dynamic keying
  if (next[playerKey]?.[group]) delete next[playerKey][group][key];
  return next;
}

export function setGroupMode(p: ControlsProfile, playerKey: "player1" | "player2" | "player3" | "player4", group: "move" | "dpad" | "look", mode: "dpad" | "stick"): ControlsProfile {
  const next = structuredClone(p);
  if (!next[playerKey]) next[playerKey] = {} as PlayerBindings;
  if (!next[playerKey]) return next;
  const player = next[playerKey];

  if (group === "move") {
    player.move = mode === "dpad" ? defaultDpad() : defaultStick("left");
  } else if (group === "dpad") {
    player.dpad = defaultDpad();
  } else {
    player.look = mode === "dpad" ? defaultDpad() : defaultStick("right");
  }

  return next;
}

export function clearGroup(p: ControlsProfile, playerKey: "player1" | "player2" | "player3" | "player4", group: "move" | "dpad" | "look"): ControlsProfile {
  const next = structuredClone(p);
  const player = next[playerKey];

  if (group === "move") {
    player.move =
      player.move.type === "stick"
        ? { type: "stick", stick: player.move.stick, deadzone: player.move.deadzone }
        : { type: "dpad" };
  } else if (group === "dpad") {
    player.dpad = { type: "dpad" };
  } else {
    player.look =
      player.look.type === "stick"
        ? { type: "stick", stick: player.look.stick, deadzone: player.look.deadzone }
        : { type: "dpad" };
  }

  return next;
}
