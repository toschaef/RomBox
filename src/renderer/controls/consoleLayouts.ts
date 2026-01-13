import type { ConsoleID } from "../../shared/types";
import type { SectionKey } from "./layout";

import btnStart from "../assets/buttons/alt/T_S_Plus_Alt.png";
import btnSelect from "../assets/buttons/alt/T_S_Minus_Alt.png";
import btnA from "../assets/buttons/alt/T_S_A_Alt.png";
import btnB from "../assets/buttons/alt/T_S_B_Alt.png";
import btnX from "../assets/buttons/alt/T_S_X_Alt.png";
import btnY from "../assets/buttons/alt/T_S_Y_Alt.png";
import btnL from "../assets/buttons/alt/T_S_LB_Alt.png";
import btnR from "../assets/buttons/alt/T_S_RB_Alt.png";
import btnZL from "../assets/buttons/alt/T_S_LT_Alt.png";
import btnZR from "../assets/buttons/alt/T_S_RT_Alt.png";

export type ConsoleControlItem =
  | {
    kind: "group";
    id: "move" | "look" | "dpad" | "c" | "special";
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
    | "z"
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

    { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

  gb: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

  gba: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: btnR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

  gg: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "1", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "2", icon: btnB, section: "face" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
  ],

  sms: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "1", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "2", icon: btnB, section: "face" },

    { kind: "digital", id: "system.start", label: "Pause", icon: btnStart, section: "system" },
  ],

  pce: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "I", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "II", icon: btnB, section: "face" },

    { kind: "digital", id: "system.start", label: "Run", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

  snes: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "X", icon: btnX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Y", icon: btnY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: btnR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

  n64: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },

    { kind: "group", id: "c", label: "C Buttons", section: "rightStick" },
    { kind: "digital", id: "z", label: "Z", icon: btnZL, section: "shoulders" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: btnR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
  ],

  ds: [
    { kind: "group", id: "move", label: "Move (Controller Stick Only)", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "B", icon: btnB, section: "face" },
    { kind: "digital", id: "face.secondary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "X", icon: btnX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Y", icon: btnY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: btnR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

  "3ds": [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "group", id: "c", label: "C-Stick", section: "rightStick" },

    { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "X", icon: btnX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Y", icon: btnY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: btnR, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerL", label: "ZL", icon: btnZL, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerR", label: "ZR", icon: btnZR, section: "shoulders" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

  gc: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "c", label: "C-Stick", section: "rightStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "X", icon: btnX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Y", icon: btnY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R", icon: btnR, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerL", label: "L (Analog)", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerR", label: "R (Analog)", icon: btnR, section: "shoulders" },

    { kind: "digital", id: "z", label: "Z", icon: btnZL, section: "special" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
  ],

  wii: [
    { kind: "group", id: "move", label: "Move", section: "leftStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },
    { kind: "digital", id: "1", label: "1", icon: btnX, section: "face" },
    { kind: "digital", id: "2", label: "2", icon: btnY, section: "face" },

    { kind: "digital", id: "system.start", label: "Plus", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Minus", icon: btnSelect, section: "system" },

    { kind: "group", id: "special", label: "Nunchuck", section: "special" },
    { kind: "digital", id: "special.nunchuckC", label: "Nunchuck C", icon: "", section: "special" },
    { kind: "digital", id: "special.nunchuckZ", label: "Nunchuck Z", icon: btnZL, section: "special" },
  ],

  ps1: [
    { kind: "group", id: "move", label: "Left Stick", section: "leftStick" },
    { kind: "group", id: "c", label: "Right Stick", section: "rightStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "Cross", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "Circle", icon: btnB, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "Square", icon: btnX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Triangle", icon: btnY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L1", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R1", icon: btnR, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerL", label: "L2", icon: btnZL, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerR", label: "R2", icon: btnZR, section: "shoulders" },
    { kind: "digital", id: "sticks.l3", label: "L3", icon: "", section: "special" },
    { kind: "digital", id: "sticks.r3", label: "R3", icon: "", section: "special" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

  ps2: [
    { kind: "group", id: "move", label: "Left Stick", section: "leftStick" },
    { kind: "group", id: "c", label: "Right Stick", section: "rightStick" },
    { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

    { kind: "digital", id: "face.primary", label: "Cross", icon: btnA, section: "face" },
    { kind: "digital", id: "face.secondary", label: "Circle", icon: btnB, section: "face" },
    { kind: "digital", id: "face.tertiary", label: "Square", icon: btnX, section: "face" },
    { kind: "digital", id: "face.quaternary", label: "Triangle", icon: btnY, section: "face" },

    { kind: "digital", id: "shoulders.bumperL", label: "L1", icon: btnL, section: "shoulders" },
    { kind: "digital", id: "shoulders.bumperR", label: "R1", icon: btnR, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerL", label: "L2", icon: btnZL, section: "shoulders" },
    { kind: "digital", id: "shoulders.triggerR", label: "R2", icon: btnZR, section: "shoulders" },
    { kind: "digital", id: "sticks.l3", label: "L3", icon: "", section: "special" },
    { kind: "digital", id: "sticks.r3", label: "R3", icon: "", section: "special" },

    { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
    { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
  ],

};

const FALLBACK_COMMON: ConsoleControlItem[] = [
  { kind: "group", id: "move", label: "Move", section: "leftStick" },
  { kind: "group", id: "dpad", label: "D-Pad", section: "dpad" },

  { kind: "digital", id: "face.primary", label: "A", icon: btnA, section: "face" },
  { kind: "digital", id: "face.secondary", label: "B", icon: btnB, section: "face" },
  { kind: "digital", id: "face.tertiary", label: "X", icon: btnX, section: "face" },
  { kind: "digital", id: "face.quaternary", label: "Y", icon: btnY, section: "face" },

  { kind: "digital", id: "shoulders.bumperL", label: "L1", icon: btnL, section: "shoulders" },
  { kind: "digital", id: "shoulders.bumperR", label: "R1", icon: btnR, section: "shoulders" },
  { kind: "digital", id: "shoulders.triggerL", label: "L2", icon: btnZL, section: "shoulders" },
  { kind: "digital", id: "shoulders.triggerR", label: "R2", icon: btnZR, section: "shoulders" },
  { kind: "digital", id: "sticks.l3", label: "L3", icon: "", section: "special" },
  { kind: "digital", id: "sticks.r3", label: "R3", icon: "", section: "special" },

  { kind: "digital", id: "system.start", label: "Start", icon: btnStart, section: "system" },
  { kind: "digital", id: "system.select", label: "Select", icon: btnSelect, section: "system" },
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