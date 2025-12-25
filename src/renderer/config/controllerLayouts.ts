import { ActionBindings, ActionDef } from "../../shared/types/controls";

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

export const SECTION_ORDER = [
  { key: "leftStick", title: "Left Stick (stick or 4 buttons)" },
  { key: "rightStick", title: "Right Stick (stick or 4 buttons)" },
  { key: "dpad", title: "D-Pad" },
  { key: "face", title: "Right Buttons" },
  { key: "shoulders", title: "Triggers / Bumpers" },
  { key: "system", title: "System" },
] as const;

export const STANDARD_LAYOUT: ActionDef[] = [
  { id: "MOVE_UP", label: "Up", icon: dpadUp, section: "dpad" },
  { id: "MOVE_DOWN", label: "Down", icon: dpadDown, section: "dpad" },
  { id: "MOVE_LEFT", label: "Left", icon: dpadLeft, section: "dpad" },
  { id: "MOVE_RIGHT", label: "Right", icon: dpadRight, section: "dpad" },

  { id: "FACE_PRIMARY", label: "A", icon: btnA, section: "face" },
  { id: "FACE_SECONDARY", label: "B", icon: btnB, section: "face" },
  { id: "FACE_TERTIARY", label: "X", icon: btnX, section: "face" },
  { id: "FACE_QUATERNARY", label: "Y", icon: btnY, section: "face" },

  { id: "BUMPER_L", label: "L1", icon: btnL, section: "shoulders" },
  { id: "BUMPER_R", label: "R1", icon: btnR, section: "shoulders" },
  { id: "TRIGGER_L", label: "L2", icon: btnZL, section: "shoulders" },
  { id: "TRIGGER_R", label: "R2", icon: btnZR, section: "shoulders" },

  { id: "START", label: "Start", icon: btnStart, section: "system" },
  { id: "SELECT", label: "Select", icon: btnSelect, section: "system" },
];

export const createEmptyBindings = (): ActionBindings => ({
  MOVE_UP: [],
  MOVE_DOWN: [],
  MOVE_LEFT: [],
  MOVE_RIGHT: [],
  FACE_PRIMARY: [],
  FACE_SECONDARY: [],
  FACE_TERTIARY: [],
  FACE_QUATERNARY: [],
  BUMPER_L: [],
  BUMPER_R: [],
  TRIGGER_L: [],
  TRIGGER_R: [],
  START: [],
  SELECT: [],
});