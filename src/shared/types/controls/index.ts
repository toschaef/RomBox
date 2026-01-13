import type { ConsoleID } from "..";
import type { GamepadToken } from "../../controls/gamepadTokens";

export type InputDevice = "keyboard" | "gamepad" | "auto";

export type N64SpecialBinding = {
  type: "n64";

  c?: DpadBinding;
  z?: DigitalBinding;
};

export type GCSpecialBinding = {
  type: "gc";

  z?: DigitalBinding;
}

export type WiiSpecialBinding = {
  type: "wii";

  nunchuckC?: DigitalBinding;
  nunchuckZ?: DigitalBinding;

  home?: DigitalBinding;
}

export type SpecialBinding =
  | N64SpecialBinding
  | GCSpecialBinding
  | WiiSpecialBinding

export type ControllerProfileMeta = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  is_default: number;
};

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

export type SticksBinding = {
  type: "sticks";
  l3?: DigitalBinding;
  r3?: DigitalBinding;
};

export type PlayerBindings = {
  move: StickBinding | DpadBinding;
  dpad: DpadBinding;
  look: StickBinding | DpadBinding;
  face: FaceBinding;
  shoulders: ShoulderBinding;
  system: SystemBinding;
  sticks?: SticksBinding;

  c?: DpadBinding;
  z?: DigitalBinding;

  special?: SpecialBinding;
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
  preferredControllerId?: string;
};

export type ConsoleLayoutBase = {
  id: string;
  consoleId: ConsoleID;
  profileId: string;
  createdAt: number;
  updatedAt: number;
  isUserModified: boolean;
};

export type ConsoleLayout<C extends ConsoleID = ConsoleID> = ConsoleLayoutBase & {
  consoleId: C;
  bindings: PlayerBindings;
};

export type AnyConsoleLayout = ConsoleLayout;