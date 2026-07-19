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
  | { kind: "digital"; id: "face.primary" | "face.secondary" | "face.tertiary" | "face.quaternary" | "shoulders.bumperL" | "shoulders.bumperR" | "shoulders.triggerL" | "shoulders.triggerR" | "sticks.l3" | "sticks.r3" | "system.start" | "system.select"; label: string; icon: string; section: SectionKey };

import dpadUp from "../assets/controls/Nintendo Switch/Vector/switch_dpad_up_outline.svg";
import dpadDown from "../assets/controls/Nintendo Switch/Vector/switch_dpad_down_outline.svg";
import dpadLeft from "../assets/controls/Nintendo Switch/Vector/switch_dpad_left_outline.svg";
import dpadRight from "../assets/controls/Nintendo Switch/Vector/switch_dpad_right_outline.svg";

import btnA from "../assets/controls/Nintendo Switch/Vector/switch_button_a_outline.svg";
import btnB from "../assets/controls/Nintendo Switch/Vector/switch_button_b_outline.svg";
import btnX from "../assets/controls/Nintendo Switch/Vector/switch_button_x_outline.svg";
import btnY from "../assets/controls/Nintendo Switch/Vector/switch_button_y_outline.svg";

import btnL from "../assets/controls/Nintendo Switch/Vector/switch_button_l_outline.svg";
import btnR from "../assets/controls/Nintendo Switch/Vector/switch_button_r_outline.svg";
import btnZL from "../assets/controls/Nintendo Switch/Vector/switch_button_zl_outline.svg";
import btnZR from "../assets/controls/Nintendo Switch/Vector/switch_button_zr_outline.svg";

import btnStart from "../assets/controls/PlayStation Series/Vector/playstation3_button_start_outline.svg";
import btnSelect from "../assets/controls/PlayStation Series/Vector/playstation3_button_select_outline.svg";

import btnL3 from "../assets/controls/Nintendo Switch/Vector/switch_stick_l_press.svg";
import btnR3 from "../assets/controls/Nintendo Switch/Vector/switch_stick_r_press.svg";

import stickLUp from "../assets/controls/Nintendo Switch/Vector/switch_stick_l_up.svg";
import stickLDown from "../assets/controls/Nintendo Switch/Vector/switch_stick_l_down.svg";
import stickLLeft from "../assets/controls/Nintendo Switch/Vector/switch_stick_l_left.svg";
import stickLRight from "../assets/controls/Nintendo Switch/Vector/switch_stick_l_right.svg";

import stickRUp from "../assets/controls/Nintendo Switch/Vector/switch_stick_r_up.svg";
import stickRDown from "../assets/controls/Nintendo Switch/Vector/switch_stick_r_down.svg";
import stickRLeft from "../assets/controls/Nintendo Switch/Vector/switch_stick_r_left.svg";
import stickRRight from "../assets/controls/Nintendo Switch/Vector/switch_stick_r_right.svg";

// @ts-expect-error webpack require.context
const svgContext = require.context("../assets/controls", true, /\.svg$/);
svgContext.keys().forEach(svgContext);

export const DIR_ICONS = { up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight } as const;

export const LEFT_STICK_SWITCH_ICONS = {
  up: stickLUp,
  down: stickLDown,
  left: stickLLeft,
  right: stickLRight,
} as const;

export const RIGHT_STICK_SWITCH_ICONS = {
  up: stickRUp,
  down: stickRDown,
  left: stickRLeft,
  right: stickRRight,
} as const;

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

  { kind: "digital", id: "sticks.l3", label: "L3", icon: btnL3, section: "special" },
  { kind: "digital", id: "sticks.r3", label: "R3", icon: btnR3, section: "special" },

  { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
  { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
];