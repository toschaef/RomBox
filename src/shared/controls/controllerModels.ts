import type { ConsoleID } from "../types";

export type ControllerModel = {
  id: string;
  name: string;
};

export const CONTROLLER_MODELS: Record<ConsoleID, ControllerModel[]> = {
  nes: [
    { id: "gamepad", name: "NES Gamepad" },
  ],
  snes: [
    { id: "gamepad", name: "SNES Gamepad" },
    // { id: "rumble", name: "Rumble Controller" },
  ],
  gb: [
    { id: "gamepad", name: "Game Boy" },
  ],
  gba: [
    { id: "gamepad", name: "Game Boy Advance" },
  ],
  gg: [
    { id: "gamepad", name: "Game Gear" },
  ],
  sms: [
    { id: "gamepad", name: "Master System Gamepad" },
  ],
  pce: [
    { id: "gamepad", name: "2-Button Controller" },
    { id: "pad6", name: "6-Button Controller" },
  ],
  n64: [
    { id: "gamepad", name: "N64 Controller" },
  ],
  ds: [
    { id: "gamepad", name: "Nintendo DS" },
  ],
  "3ds": [
    { id: "gamepad", name: "Nintendo 3DS" },
    // { id: "circle_pad_pro", name: "Circle Pad Pro" },
  ],
  gc: [
    { id: "gamepad", name: "GameCube Controller" },
  ],
  wii: [
    { id: "wiimote", name: "Wii Remote (Vertical)" },
    { id: "wiimote_sideways", name: "Wii Remote (Sideways)" },
    { id: "wiimote_nunchuk", name: "Wii Remote + Nunchuk" },
    { id: "classic", name: "Classic Controller" },
    { id: "gamecube", name: "GameCube Controller" },
  ],
  ps1: [
    { id: "analog", name: "Analog Controller (DualShock)" },
    { id: "digital", name: "Digital Controller" },
  ],
  ps2: [
    { id: "dualshock2", name: "DualShock 2" },
  ],
};

export function getSupportedControllers(consoleId: ConsoleID): ControllerModel[] {
  return CONTROLLER_MODELS[consoleId] ?? [];
}

export function getDefaultControllerId(consoleId: ConsoleID): string {
  const models = getSupportedControllers(consoleId);
  return models.length > 0 ? models[0].id : "gamepad";
}
