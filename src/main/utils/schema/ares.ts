export const ARES = {
  id: "ares",
  settingsFile: "settings.bml",
  virtualPad1: ["VirtualPad1"] as const,

  keys: {
    dpadUp: "Pad.Up",
    dpadDown: "Pad.Down",
    dpadLeft: "Pad.Left",
    dpadRight: "Pad.Right",
    select: "Select",
    start: "Start",
    a: "A..South",
    b: "B..East",
    x: "X..West",
    y: "Y..North",
    l: "L-Bumper",
    r: "R-Bumper",
    z: "L-Trigger",
    rTrigger: "R-Trigger",
    lClick: "L-Stick..Click",
    rClick: "R-Stick..Click",
    lUp: "L-Up",
    lDown: "L-Down",
    lLeft: "L-Left",
    lRight: "L-Right",
    rUp: "R-Up",
    rDown: "R-Down",
    rLeft: "R-Left",
    rRight: "R-Right",
    rumble: "Rumble",
  },

  allPadKeys: [
    "Pad.Up",
    "Pad.Down",
    "Pad.Left",
    "Pad.Right",
    "Select",
    "Start",
    "A..South",
    "B..East",
    "X..West",
    "Y..North",
    "L-Bumper",
    "R-Bumper",
    "L-Trigger",
    "R-Trigger",
    "L-Stick..Click",
    "R-Stick..Click",
    "L-Up",
    "L-Down",
    "L-Left",
    "L-Right",
    "R-Up",
    "R-Down",
    "R-Left",
    "R-Right",
    "Rumble",
  ] as const,
} as const;

export const ARES_QUARTZ_KEYS = [
  "Escape","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20",
  "Tilde","Num1","Num2","Num3","Num4","Num5","Num6","Num7","Num8","Num9","Num0",
  "Dash","Equal","Delete",
  "Erase","Home","End","PageUp","PageDown",
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "LeftBracket","RightBracket","Backslash","Semicolon","Apostrophe","Comma","Period","Slash",
  "Keypad1","Keypad2","Keypad3","Keypad4","Keypad5","Keypad6","Keypad7","Keypad8","Keypad9","Keypad0",
  "Clear","Equals","Divide","Multiply","Subtract","Add","Enter","Decimal",
  "Up","Down","Left","Right",
  "Tab","Return","Spacebar","Shift","Control","Option","Command",
] as const;

export const ARES_QUARTZ_KEY_INDEX: Record<string, number> =
  Object.fromEntries(ARES_QUARTZ_KEYS.map((k, i) => [k, i]));

const DOM_TO_ARES_KEY: Record<string, string> = {
  Escape: "Escape",

  Backquote: "Tilde",
  Minus: "Dash",
  Equal: "Equal",
  Backspace: "Delete",
  Delete: "Erase",

  BracketLeft: "LeftBracket",
  BracketRight: "RightBracket",
  Backslash: "Backslash",
  Semicolon: "Semicolon",
  Quote: "Apostrophe",
  Comma: "Comma",
  Period: "Period",
  Slash: "Slash",

  Tab: "Tab",
  Enter: "Return",
  Space: "Spacebar",

  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",

  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",

  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Control",
  ControlRight: "Control",
  AltLeft: "Option",
  AltRight: "Option",
  MetaLeft: "Command",
  MetaRight: "Command",

  Numpad0: "Keypad0",
  Numpad1: "Keypad1",
  Numpad2: "Keypad2",
  Numpad3: "Keypad3",
  Numpad4: "Keypad4",
  Numpad5: "Keypad5",
  Numpad6: "Keypad6",
  Numpad7: "Keypad7",
  Numpad8: "Keypad8",
  Numpad9: "Keypad9",
  NumLock: "Clear",
  NumpadDivide: "Divide",
  NumpadMultiply: "Multiply",
  NumpadSubtract: "Subtract",
  NumpadAdd: "Add",
  NumpadDecimal: "Decimal",
  NumpadEnter: "Enter",

  NumpadEqual: "Equals",
};

function domCodeToAresKeyName(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) return code[3];

  if (code.startsWith("Digit") && code.length === 6) return `Num${code[5]}`;

  if (code[0] === "F") {
    const n = Number(code.slice(1));
    if (Number.isFinite(n) && n >= 1 && n <= 20) return code;
  }

  return DOM_TO_ARES_KEY[code] ?? null;
}

export function resolveQuartzKeyboardKeyIndex(code: string): number | null {
  const aresName = domCodeToAresKeyName(code);
  if (!aresName) return null;
  const idx = ARES_QUARTZ_KEY_INDEX[aresName];
  return Number.isInteger(idx) ? idx : null;
}