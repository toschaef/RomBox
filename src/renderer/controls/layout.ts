export type SectionKey =
  | "leftStick"
  | "dpad"
  | "face"
  | "rightStick"
  | "shoulders"
  | "system"
  | "special";

export const SECTION_ORDER = [
  { key: "leftStick", title: "Left Stick (stick or 4 buttons)" },
  { key: "dpad", title: "D-Pad (4 buttons or stick)" },
  { key: "face", title: "Right Buttons" },
  { key: "rightStick", title: "Right Stick (stick or 4 buttons)" },
  { key: "shoulders", title: "Triggers / Bumpers" },
  { key: "special", label: "Special" },
  { key: "system", title: "System" },
] as const;

export type ControlItem =
  | { kind: "group"; id: "move" | "dpad" | "look"; label: string; icon?: string; section: "leftStick" | "dpad" | "rightStick" }
  | { kind: "digital"; id: "face.primary" | "face.secondary" | "face.tertiary" | "face.quaternary" | "shoulders.bumperL" | "shoulders.bumperR" | "shoulders.triggerL" | "shoulders.triggerR" | "system.start" | "system.select"; label: string; icon: string; section: SectionKey };

import dpadUp from "../assets/buttons/alt/T_S_Dpad_Up_Alt.png";
import dpadDown from "../assets/buttons/alt/T_S_Dpad_Down_Alt.png";
import dpadLeft from "../assets/buttons/alt/T_S_Dpad_Left_Alt.png";
import dpadRight from "../assets/buttons/alt/T_S_Dpad_Right_Alt.png";

import btnA from "../assets/buttons/alt/T_S_A_Alt.png";
import btnB from "../assets/buttons/alt/T_S_B_Alt.png";
import btnX from "../assets/buttons/alt/T_S_X_Alt.png";
import btnY from "../assets/buttons/alt/T_S_Y_Alt.png";

import btnL from "../assets/buttons/alt/T_S_LB_Alt.png";
import btnR from "../assets/buttons/alt/T_S_RB_Alt.png";
import btnZL from "../assets/buttons/alt/T_S_LT_Alt.png";
import btnZR from "../assets/buttons/alt/T_S_RT_Alt.png";

import btnStart from "../assets/buttons/alt/T_S_Plus_Alt.png";
import btnSelect from "../assets/buttons/alt/T_S_Minus_Alt.png";

export const DIR_ICONS = { up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight } as const;

export const STANDARD_LAYOUT: ControlItem[] = [
  { kind: "group", id: "move", label: "Move", section: "leftStick" },
  { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },
  { kind: "group", id: "look", label: "Look", section: "rightStick" },

  { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
  { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },
  { kind: "digital", id: "face.tertiary", label: "X", icon: btnX, section: "face" },
  { kind: "digital", id: "face.quaternary", label: "Y", icon: btnY, section: "face" },

  { kind: "digital", id: "shoulders.bumperL", label: "L1", icon: btnL, section: "shoulders" },
  { kind: "digital", id: "shoulders.bumperR", label: "R1", icon: btnR, section: "shoulders" },
  { kind: "digital", id: "shoulders.triggerL", label: "L2", icon: btnZL, section: "shoulders" },
  { kind: "digital", id: "shoulders.triggerR", label: "R2", icon: btnZR, section: "shoulders" },

  { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
  { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
];