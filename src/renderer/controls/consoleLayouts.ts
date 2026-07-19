import type { ConsoleID } from "../../shared/types";
import type { SectionKey } from "./layout";

// Switch Buttons
import switchA from "../assets/controls/Nintendo Switch/Vector/switch_button_a_outline.svg";
import switchB from "../assets/controls/Nintendo Switch/Vector/switch_button_b_outline.svg";
import switchX from "../assets/controls/Nintendo Switch/Vector/switch_button_x_outline.svg";
import switchY from "../assets/controls/Nintendo Switch/Vector/switch_button_y_outline.svg";
import switchL from "../assets/controls/Nintendo Switch/Vector/switch_button_l_outline.svg";
import switchR from "../assets/controls/Nintendo Switch/Vector/switch_button_r_outline.svg";
import switchZL from "../assets/controls/Nintendo Switch/Vector/switch_button_zl_outline.svg";
import switchZR from "../assets/controls/Nintendo Switch/Vector/switch_button_zr_outline.svg";
import switchPlus from "../assets/controls/Nintendo Switch/Vector/switch_button_plus_outline.svg";
import switchMinus from "../assets/controls/Nintendo Switch/Vector/switch_button_minus_outline.svg";
import switchL3 from "../assets/controls/Nintendo Switch/Vector/switch_stick_l_press.svg";
import switchR3 from "../assets/controls/Nintendo Switch/Vector/switch_stick_r_press.svg";

// PlayStation Buttons
import psCross from "../assets/controls/PlayStation Series/Vector/playstation_button_cross_outline.svg";
import psCircle from "../assets/controls/PlayStation Series/Vector/playstation_button_circle_outline.svg";
import psSquare from "../assets/controls/PlayStation Series/Vector/playstation_button_square_outline.svg";
import psTriangle from "../assets/controls/PlayStation Series/Vector/playstation_button_triangle_outline.svg";
import psL1 from "../assets/controls/PlayStation Series/Vector/playstation_trigger_l1_outline.svg";
import psR1 from "../assets/controls/PlayStation Series/Vector/playstation_trigger_r1_outline.svg";
import psL2 from "../assets/controls/PlayStation Series/Vector/playstation_trigger_l2_outline.svg";
import psR2 from "../assets/controls/PlayStation Series/Vector/playstation_trigger_r2_outline.svg";
import psL3 from "../assets/controls/PlayStation Series/Vector/playstation_button_l3_outline.svg";
import psR3 from "../assets/controls/PlayStation Series/Vector/playstation_button_r3_outline.svg";
import psStart from "../assets/controls/PlayStation Series/Vector/playstation3_button_start_outline.svg";
import psSelect from "../assets/controls/PlayStation Series/Vector/playstation3_button_select_outline.svg";

// GameCube Buttons
import gcA from "../assets/controls/Nintendo Gamecube/Vector/gamecube_button_a_outline.svg";
import gcB from "../assets/controls/Nintendo Gamecube/Vector/gamecube_button_b_outline.svg";
import gcX from "../assets/controls/Nintendo Gamecube/Vector/gamecube_button_x_outline.svg";
import gcY from "../assets/controls/Nintendo Gamecube/Vector/gamecube_button_y_outline.svg";
import gcZ from "../assets/controls/Nintendo Gamecube/Vector/gamecube_button_z_outline.svg";
import gcL from "../assets/controls/Nintendo Gamecube/Vector/gamecube_trigger_l_outline.svg";
import gcR from "../assets/controls/Nintendo Gamecube/Vector/gamecube_trigger_r_outline.svg";
import gcStart from "../assets/controls/Nintendo Gamecube/Vector/gamecube_button_start_outline.svg";

// Wii Buttons
import wiiA from "../assets/controls/Nintendo Wii/Vector/wii_button_a_outline.svg";
import wiiB from "../assets/controls/Nintendo Wii/Vector/wii_button_b_outline.svg";
import wii1 from "../assets/controls/Nintendo Wii/Vector/wii_button_1_outline.svg";
import wii2 from "../assets/controls/Nintendo Wii/Vector/wii_button_2_outline.svg";
import wiiPlus from "../assets/controls/Nintendo Wii/Vector/wii_button_plus_outline.svg";
import wiiMinus from "../assets/controls/Nintendo Wii/Vector/wii_button_minus_outline.svg";
import wiiZ from "../assets/controls/Nintendo Wii/Vector/wii_button_z_outline.svg";
import wiiC from "../assets/controls/Nintendo Wii/Vector/wii_button_c_outline.svg";

// GameCube D-pad
import gcDpadUp from "../assets/controls/Nintendo Gamecube/Vector/gamecube_dpad_up_outline.svg";
import gcDpadDown from "../assets/controls/Nintendo Gamecube/Vector/gamecube_dpad_down_outline.svg";
import gcDpadLeft from "../assets/controls/Nintendo Gamecube/Vector/gamecube_dpad_left_outline.svg";
import gcDpadRight from "../assets/controls/Nintendo Gamecube/Vector/gamecube_dpad_right_outline.svg";

// Wii D-pad
import wiiDpadUp from "../assets/controls/Nintendo Wii/Vector/wii_dpad_up_outline.svg";
import wiiDpadDown from "../assets/controls/Nintendo Wii/Vector/wii_dpad_down_outline.svg";
import wiiDpadLeft from "../assets/controls/Nintendo Wii/Vector/wii_dpad_left_outline.svg";
import wiiDpadRight from "../assets/controls/Nintendo Wii/Vector/wii_dpad_right_outline.svg";

// PlayStation D-pad
import psDpadUp from "../assets/controls/PlayStation Series/Vector/playstation_dpad_up_outline.svg";
import psDpadDown from "../assets/controls/PlayStation Series/Vector/playstation_dpad_down_outline.svg";
import psDpadLeft from "../assets/controls/PlayStation Series/Vector/playstation_dpad_left_outline.svg";
import psDpadRight from "../assets/controls/PlayStation Series/Vector/playstation_dpad_right_outline.svg";

// Switch D-pad
import switchDpadUp from "../assets/controls/Nintendo Switch/Vector/switch_dpad_up_outline.svg";
import switchDpadDown from "../assets/controls/Nintendo Switch/Vector/switch_dpad_down_outline.svg";
import switchDpadLeft from "../assets/controls/Nintendo Switch/Vector/switch_dpad_left_outline.svg";
import switchDpadRight from "../assets/controls/Nintendo Switch/Vector/switch_dpad_right_outline.svg";

export type ConsoleControlItem =
  | {
    kind: "group";
    id: "move" | "look" | "dpad" | "special.c" | "special";
    label: string;
    section: "leftStick" | "dpad" | "rightStick" | "special";
  }
  | {
    kind: "digital";
    id:
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
    | "system.select"
    | "1"
    | "2"
    | "special.c"
    | "special.z"
    | "special.nunchuckZ"
    | "special.nunchuckC";
    label: string;
    icon: string;
    section: SectionKey;
  };

export const CONSOLE_LAYOUTS: Partial<Record<ConsoleID, ConsoleControlItem[]>> = {
  nes: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: switchA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: switchB, section: "face" },

    { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: switchMinus, section: "system" },
  ],

  gb: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: switchA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: switchB, section: "face" },

    { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: switchMinus, section: "system" },
  ],

  gba: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: switchA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: switchB, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: switchL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: switchR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: switchMinus, section: "system" },
  ],

  gg: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "1", icon: wii1, section: "face" },
    { kind: "digital", id: "face.secondary", label: "2", icon: wii2, section: "face" },

    { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
  ],

  sms: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "1", icon: wii1, section: "face" },
    { kind: "digital", id: "face.secondary", label: "2", icon: wii2, section: "face" },

    { kind: "digital", id: "system.start", label: "Pause", icon: switchPlus, section: "system" },
  ],

  pce: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "I", icon: switchA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "II", icon: switchB, section: "face" },

    { kind: "digital", id: "system.start", label: "Run", icon: switchPlus, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: switchMinus, section: "system" },
  ],

  snes: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: switchA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: switchB, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "X", icon: switchX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Y", icon: switchY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: switchL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: switchR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: switchMinus, section: "system" },
  ],

  n64: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: switchA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: switchB, section: "face" },

    { kind: "group", id: "special.c", label: "C Buttons", section: "rightStick" },
    { kind: "digital", id: "special.z", label: "Z", icon: switchZL, section: "shoulders" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: switchL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: switchR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
  ],

  ds: [
    { kind: "group", id: "move", label: "Move (Controller Stick Only)", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "B", icon: switchB, section: "face" },
    { kind: "digital", id: "face.secondary", label: "A", icon: switchA, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "X", icon: switchX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Y", icon: switchY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: switchL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: switchR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: switchMinus, section: "system" },
  ],

  "3ds": [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "group", id: "look", label: "C-Stick", section: "rightStick" },

    { kind: "digital", id: "face.primary", label: "A", icon: switchA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: switchB, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "X", icon: switchX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Y", icon: switchY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: switchL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: switchR, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerL", label: "ZL", icon: switchZL, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerR", label: "ZR", icon: switchZR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: switchMinus, section: "system" },
  ],

  gc: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "look", label: "C-Stick", section: "rightStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: gcA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: gcB, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "X", icon: gcX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Y", icon: gcY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: gcL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: gcR, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerL", label: "L (Analog)", icon: gcL, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerR", label: "R (Analog)", icon: gcR, section: "shoulders" },

    { kind: "digital", id: "special.z", label: "Z", icon: gcZ, section: "special" },

    { kind: "digital", id: "system.start", label: "Start", icon: gcStart, section: "system" },
  ],

  wii: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: wiiA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: wiiB, section: "face" },
    { kind: "digital", id: "1", label: "1", icon: wii1, section: "face" },
    { kind: "digital", id: "2", label: "2", icon: wii2, section: "face" },

    { kind: "digital", id: "system.start", label: "Plus", icon: wiiPlus, section: "system" },
    { kind: "digital", id: "system.select", label: "Minus", icon: wiiMinus, section: "system" },

    { kind: "group", id: "special", label: "Nunchuck", section: "special" },
    { kind: "digital", id: "special.nunchuckC", label: "Nunchuck C", icon: wiiC, section: "special" },
    { kind: "digital", id: "special.nunchuckZ", label: "Nunchuck Z", icon: wiiZ, section: "special" },
  ],

  ps1: [
    { kind: "group", id: "move", label: "Left Stick", section: "leftStick" },
    { kind: "group", id: "look", label: "Right Stick", section: "rightStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "Cross", icon: psCross, section: "face" },
    { kind: "digital", id: "face.secondary", label: "Circle", icon: psCircle, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "Square", icon: psSquare, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Triangle", icon: psTriangle, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L1", icon: psL1, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R1", icon: psR1, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerL", label: "L2", icon: psL2, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerR", label: "R2", icon: psR2, section: "shoulders" },
    { kind: "digital", id: "sticks.l3", label: "L3", icon: psL3, section: "special" },
    { kind: "digital", id: "sticks.r3", label: "R3", icon: psR3, section: "special" },

    { kind: "digital", id: "system.start", label: "Start", icon: psStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: psSelect, section: "system" },
  ],

  ps2: [
    { kind: "group", id: "move", label: "Left Stick", section: "leftStick" },
    { kind: "group", id: "look", label: "Right Stick", section: "rightStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "Cross", icon: psCross, section: "face" },
    { kind: "digital", id: "face.secondary", label: "Circle", icon: psCircle, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "Square", icon: psSquare, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Triangle", icon: psTriangle, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L1", icon: psL1, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R1", icon: psR1, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerL", label: "L2", icon: psL2, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerR", label: "R2", icon: psR2, section: "shoulders" },
    { kind: "digital", id: "sticks.l3", label: "L3", icon: psL3, section: "special" },
    { kind: "digital", id: "sticks.r3", label: "R3", icon: psR3, section: "special" },

    { kind: "digital", id: "system.start", label: "Start", icon: psStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: psSelect, section: "system" },
  ],

};

const FALLBACK_COMMON: ConsoleControlItem[] = [
  { kind: "group", id: "move", label: "Move", section: "leftStick" },
  { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

  { kind: "digital", id: "face.primary", label: "A", icon: switchA, section: "face" },
  { kind: "digital", id: "face.secondary", label: "B", icon: switchB, section: "face" },
  { kind: "digital", id: "face.tertiary", label: "X", icon: switchX, section: "face" },
  { kind: "digital", id: "face.quaternary", label: "Y", icon: switchY, section: "face" },

  { kind: "digital", id: "shoulders.bumperL", label: "L1", icon: switchL, section: "shoulders" },
  { kind: "digital", id: "shoulders.bumperR", label: "R1", icon: switchR, section: "shoulders" },
  { kind: "digital", id: "shoulders.triggerL", label: "L2", icon: switchZL, section: "shoulders" },
  { kind: "digital", id: "shoulders.triggerR", label: "R2", icon: switchZR, section: "shoulders" },
  { kind: "digital", id: "sticks.l3", label: "L3", icon: switchL3, section: "special" },
  { kind: "digital", id: "sticks.r3", label: "R3", icon: switchR3, section: "special" },

  { kind: "digital", id: "system.start", label: "Start", icon: switchPlus, section: "system" },
  { kind: "digital", id: "system.select", label: "Select", icon: switchMinus, section: "system" },
];

export function getConsoleLayoutItems(consoleId: ConsoleID): ConsoleControlItem[] {
  return CONSOLE_LAYOUTS[consoleId] ?? FALLBACK_COMMON;
}

export const CONSOLE_OPTIONS: { id: ConsoleID; name: string }[] = [
  { id: "nes", name: "NES" },
  { id: "snes", name: "SNES" },
  { id: "gb", name: "Game Boy" },
  { id: "gba", name: "Game Boy Advance" },
  { id: "gg", name: "Game Gear" },
  { id: "sms", name: "Sega Master System" },
  { id: "pce", name: "PC Engine" },
  { id: "n64", name: "Nintendo 64" },
  { id: "ds", name: "Nintendo DS" },
  { id: "3ds", name: "Nintendo 3DS" },
  { id: "gc", name: "GameCube" },
  { id: "wii", name: "Wii" },
  { id: "ps1", name: "PlayStation 1" },
  { id: "ps2", name: "PlayStation 2" },
];

export function getConsoleDpadIcons(consoleId: ConsoleID): { up: string; down: string; left: string; right: string } {
  if (consoleId === "gc") {
    return { up: gcDpadUp, down: gcDpadDown, left: gcDpadLeft, right: gcDpadRight };
  }
  if (consoleId === "wii") {
    return { up: wiiDpadUp, down: wiiDpadDown, left: wiiDpadLeft, right: wiiDpadRight };
  }
  if (consoleId === "ps1" || consoleId === "ps2") {
    return { up: psDpadUp, down: psDpadDown, left: psDpadLeft, right: psDpadRight };
  }
  return { up: switchDpadUp, down: switchDpadDown, left: switchDpadLeft, right: switchDpadRight };
}