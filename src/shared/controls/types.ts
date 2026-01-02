import type { GamepadToken } from "./gamepadTokens";

export type InputDevice = "keyboard" | "gamepad" | "auto";

export type DigitalBinding =
  | { type: "key"; code: string }
  | { type: "gp_button"; token: GamepadToken }
  | {
      type: "gp_axis_digital";
      stick: "left" | "right";
      axis: "x" | "y";
      dir: "neg" | "pos";
      threshold: number;
    };

export type StickBinding = {
  type: "stick";
  stick: "left" | "right";
  deadzone: number;
  invertX?: boolean;
  invertY?: boolean;
};

export type DpadBinding = {
  type: "dpad";
  up?: DigitalBinding;
  down?: DigitalBinding;
  left?: DigitalBinding;
  right?: DigitalBinding;
};

export type FaceBinding = {
  type: "face";
  primary?: DigitalBinding;
  secondary?: DigitalBinding;
  tertiary?: DigitalBinding;
  quaternary?: DigitalBinding;
};

export type ShoulderBinding = {
  type: "shoulders";
  bumperL?: DigitalBinding;
  bumperR?: DigitalBinding;
  triggerL?: DigitalBinding;
  triggerR?: DigitalBinding;
};

export type SystemBinding = {
  type: "system";
  start?: DigitalBinding;
  select?: DigitalBinding;
};

export type PlayerBindings = {
  move: StickBinding | DpadBinding;
  dpad: DpadBinding;
  look: StickBinding | DpadBinding;
  face: FaceBinding;
  shoulders: ShoulderBinding;
  system: SystemBinding;
};

export type ControlsProfile = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
  preferredDevice: InputDevice;
  player1: PlayerBindings;
  melonJoystickId?: number;
};

export function createDefaultProfileShape(): Omit<ControlsProfile, "id" | "name" | "createdAt" | "updatedAt" | "isDefault"> {
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

export type ProfileMeta = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  is_default: number;
};