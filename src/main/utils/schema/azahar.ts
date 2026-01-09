export const AZAHAR = {
  id: "azahar",
  iniFileName: "qt-config.ini",
  sections: {
    controls: "Controls",
    ui: "UI",
  } as const,

  activeProfileIndex: 0,
  profileName: "rombox",

  paramEmpty: "[empty]",

  keys: {
    button_a: "button_a",
    button_b: "button_b",
    button_x: "button_x",
    button_y: "button_y",

    button_up: "button_up",
    button_down: "button_down",
    button_left: "button_left",
    button_right: "button_right",

    button_l: "button_l",
    button_r: "button_r",
    button_zl: "button_zl",
    button_zr: "button_zr",

    button_start: "button_start",
    button_select: "button_select",

    button_debug: "button_debug",
    button_gpio14: "button_gpio14",
    button_home: "button_home",
    button_power: "button_power",

    circle_pad: "circle_pad",
    c_stick: "c_stick",

    motion_device: "motion_device",
    touch_device: "touch_device",
    use_touch_from_button: "use_touch_from_button",
    touch_from_button_map: "touch_from_button_map",
    udp_input_address: "udp_input_address",
    udp_input_port: "udp_input_port",
    udp_pad_index: "udp_pad_index",
  } as const,
} as const;

export function azQtArraySlot(logicalIndex: number): number {
  return logicalIndex + 1;
}

export function azActiveProfileKey() {
  return `profile`;
}
export function azActiveProfileDefaultKey() {
  return `profile\\default`;
}
export function azProfilesSizeKey() {
  return `profiles\\size`;
}
export function azProfileKey(logicalProfileIndex: number, key: string) {
  const slot = azQtArraySlot(logicalProfileIndex);
  return `profiles\\${slot}\\${key}`;
}
export function azProfileDefaultKey(logicalProfileIndex: number, key: string) {
  const slot = azQtArraySlot(logicalProfileIndex);
  return `profiles\\${slot}\\${key}\\default`;
}

export function azTouchMapsSizeKey() {
  return `touch_from_button_maps\\size`;
}
export function azTouchMapKey(logicalMapIndex: number, key: string) {
  const slot = azQtArraySlot(logicalMapIndex);
  return `touch_from_button_maps\\${slot}\\${key}`;
}
export function azTouchMapDefaultKey(logicalMapIndex: number, key: string) {
  const slot = azQtArraySlot(logicalMapIndex);
  return `touch_from_button_maps\\${slot}\\${key}\\default`;
}
export function azTouchMapEntriesSizeKey(logicalMapIndex: number) {
  const slot = azQtArraySlot(logicalMapIndex);
  return `touch_from_button_maps\\${slot}\\entries\\size`;
}

export function qtKeycodeFromDomCode(code: string): number | null {
  if (code.startsWith("Key") && code.length === 4) return code[3]!.toUpperCase().charCodeAt(0);
  if (code.startsWith("Digit") && code.length === 6) return code[5]!.charCodeAt(0);

  switch (code) {
    case "ArrowUp": return 16777235;
    case "ArrowDown": return 16777237;
    case "ArrowLeft": return 16777234;
    case "ArrowRight": return 16777236;
    case "Enter": return 16777220;
    case "Escape": return 16777216;
    case "Space": return 32;
    case "Tab": return 16777217;
    case "Backspace": return 16777219;
    case "ShiftLeft":
    case "ShiftRight": return 16777248;
    case "ControlLeft":
    case "ControlRight": return 16777249;
    case "AltLeft":
    case "AltRight": return 16777251;
    default: return null;
  }
}