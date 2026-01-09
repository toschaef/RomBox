import type { ControlsProfile, DigitalBinding, DpadBinding, StickBinding } from "../../shared/controls/types";
import { axisToDigitalToken, type GamepadToken } from "../../shared/controls/gamepadTokens";

export type Dir = "up" | "down" | "left" | "right";

const DEFAULT_AXIS_THRESHOLD = 0.65; // todo: make this a setting

export function dpadDirBinding(dpad: DpadBinding, dir: Dir): DigitalBinding | undefined {
  return dpad[dir];
}

export function getDpadLike(profile: ControlsProfile, dir: Dir): DigitalBinding | undefined {
  const p1 = profile.player1;

  const move = (p1 as any).move as DpadBinding | StickBinding | undefined;
  if (move && move.type === "dpad") {
    const fromMove = pickDir(move, dir);
    if (fromMove) return fromMove;
  }

  const dpad = (p1 as any).dpad as DpadBinding | undefined;
  if (dpad && dpad.type === "dpad") {
    const fromDpad = pickDir(dpad, dir);
    if (fromDpad) return fromDpad;
  }

  return undefined;
}

export function digitalToGamepadToken(d: DigitalBinding): GamepadToken | null {
  if (d.type === "gp_button") return d.token;
  if (d.type === "gp_axis_digital") {
    return axisToDigitalToken({
      stick: d.stick,
      axis: d.axis,
      sign: d.dir === "neg" ? -1 : 1,
    });
  }
  return null;
}

function pickDir(d: DpadBinding, dir: Dir): DigitalBinding | undefined {
  if (dir === "up") return d.up;
  if (dir === "down") return d.down;
  if (dir === "left") return d.left;
  return d.right;
}

export function getDirFromDpad(profile: ControlsProfile, dir: Dir): DigitalBinding | undefined {
  return pickDir(profile.player1.dpad, dir);
}

export function getDirFromMove(profile: ControlsProfile, dir: Dir): DigitalBinding | undefined {
  const m = profile.player1.move;

  if (m.type === "dpad") {
    return pickDir(m, dir);
  }

  const stick = m.stick;
  const threshold = DEFAULT_AXIS_THRESHOLD;

  const invX = !!m.invertX;
  const invY = !!m.invertY;

  if (dir === "left")  return { type: "gp_axis_digital", stick, axis: "x", dir: invX ? "pos" : "neg", threshold };
  if (dir === "right") return { type: "gp_axis_digital", stick, axis: "x", dir: invX ? "neg" : "pos", threshold };

  // y is swapped!!!
  if (dir === "up") return { type: "gp_axis_digital", stick, axis: "y", dir: invY ? "neg" : "pos", threshold };
  return { type: "gp_axis_digital", stick, axis: "y", dir: invY ? "pos" : "neg", threshold };
}

export function getStickDirFromMove(profile: ControlsProfile, dir: "up" | "down" | "left" | "right"): DigitalBinding | undefined {
  const m = profile.player1.move;
  if (m.type !== "stick") return undefined;

  const stick = m.stick;
  const threshold = 0.65;

  const invX = !!m.invertX;
  const invY = !!m.invertY;

  if (dir === "left")  return { type: "gp_axis_digital", stick, axis: "x", dir: invX ? "pos" : "neg", threshold };
  if (dir === "right") return { type: "gp_axis_digital", stick, axis: "x", dir: invX ? "neg" : "pos", threshold };
  if (dir === "up")    return { type: "gp_axis_digital", stick, axis: "y", dir: invY ? "pos" : "neg", threshold };

  return { type: "gp_axis_digital", stick, axis: "y", dir: invY ? "neg" : "pos", threshold };
}

export function getDirUnion(profile: ControlsProfile, dir: Dir): DigitalBinding | undefined {
  return getDirFromDpad(profile, dir) ?? getDirFromMove(profile, dir);
}

export function getDirFromBinding(
  binding: StickBinding | DpadBinding | undefined,
  dir: Dir
): DigitalBinding | undefined {
  if (!binding) return undefined;

  if (binding.type === "dpad") {
    return pickDir(binding, dir);
  }

  const stick = binding.stick;
  const threshold = DEFAULT_AXIS_THRESHOLD;

  const invX = !!binding.invertX;
  const invY = !!binding.invertY;

  if (dir === "left")  return { type: "gp_axis_digital", stick, axis: "x", dir: invX ? "pos" : "neg", threshold };
  if (dir === "right") return { type: "gp_axis_digital", stick, axis: "x", dir: invX ? "neg" : "pos", threshold };
  if (dir === "up")    return { type: "gp_axis_digital", stick, axis: "y", dir: invY ? "pos" : "neg", threshold };

  return { type: "gp_axis_digital", stick, axis: "y", dir: invY ? "neg" : "pos", threshold };
}

export function getDirFromLook(profile: ControlsProfile, dir: Dir): DigitalBinding | undefined {
  return getDirFromBinding(profile.player1.look, dir);
}