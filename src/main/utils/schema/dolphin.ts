import path from "path";
import { app } from "electron";
import { spawnSync } from "child_process";
import type { GamepadToken } from "../../../shared/controls/gamepadTokens";

export const DOLPHIN = {
  GC_PROFILE_NAME: "RomBox_P1",
  WII_PROFILE_NAME: "RomBox_Wii_P1",
  MAC_QUARTZ_DEVICE: "Quartz/0/Keyboard & Mouse",
  GCPAD_NEW_INI: "GCPadNew.ini",
  WIIMOTE_NEW_INI: "WiimoteNew.ini",

  gcPadNewPath(configDir: string) {
    return path.join(configDir, this.GCPAD_NEW_INI);
  },
  wiimoteNewPath(configDir: string) {
    return path.join(configDir, this.WIIMOTE_NEW_INI);
  },
};

export function quartzKeyFromDomCode(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);

  const map: Record<string, string> = Object.assign(Object.create(null), {
    ArrowUp: "Up Arrow",
    ArrowDown: "Down Arrow",
    ArrowLeft: "Left Arrow",
    ArrowRight: "Right Arrow",
    Enter: "Return",
    NumpadEnter: "Return",
    Space: "Space",
    Escape: "Escape",
    Tab: "Tab",
    Backspace: "Backspace",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
    AltLeft: "Alt",
    AltRight: "Alt",
    Comma: ",",
    Period: ".",
    Semicolon: ";",
    Quote: "'",
    Slash: "/",
    Backslash: "\\",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backquote: "`",
  });

  return map[code] ?? null;
}

const TOK_TO_SDL3_BUTTON: Record<string, number> = Object.assign(Object.create(null), {
  GP_A: 0,
  GP_B: 1,
  GP_X: 2,
  GP_Y: 3,
  GP_SELECT: 4,
  GP_GUIDE: 5,
  GP_START: 6,
  GP_L3: 7,
  GP_R3: 8,
  GP_L1: 9,
  GP_R1: 10,
  GP_DPAD_UP: 11,
  GP_DPAD_DOWN: 12,
  GP_DPAD_LEFT: 13,
  GP_DPAD_RIGHT: 14,
});

export function dolphinExprForGamepadToken(tok: GamepadToken, platform: string = "win32", learnedBinds?: any): string | null {
  const isSdl = platform !== "win32";
  let expr = "";
  switch (tok) {
    case "GP_A": expr = isSdl ? "`Button S`" : "`Button A`"; break;
    case "GP_B": expr = isSdl ? "`Button E`" : "`Button B`"; break;
    case "GP_X": expr = isSdl ? "`Button W`" : "`Button X`"; break;
    case "GP_Y": expr = isSdl ? "`Button N`" : "`Button Y`"; break;
    case "GP_SELECT": expr = "`Back`"; break;
    case "GP_START": expr = "`Start`"; break;
    case "GP_L3": expr = "`Thumb L`"; break;
    case "GP_R3": expr = "`Thumb R`"; break;
    case "GP_L1": expr = "`Shoulder L`"; break;
    case "GP_R1": expr = "`Shoulder R`"; break;
    case "GP_L2": expr = "`Trigger L`"; break;
    case "GP_R2": expr = "`Trigger R`"; break;
    case "GP_DPAD_UP": expr = isSdl ? "`Pad N`" : "`D-Pad Up`"; break;
    case "GP_DPAD_DOWN": expr = isSdl ? "`Pad S`" : "`D-Pad Down`"; break;
    case "GP_DPAD_LEFT": expr = isSdl ? "`Pad W`" : "`D-Pad Left`"; break;
    case "GP_DPAD_RIGHT": expr = isSdl ? "`Pad E`" : "`D-Pad Right`"; break;
    case "GP_LS_LEFT": return "`Left X-`";
    case "GP_LS_RIGHT": return "`Left X+`";
    case "GP_LS_UP": return "`Left Y+`";
    case "GP_LS_DOWN": return "`Left Y-`";
    case "GP_RS_LEFT": return "`Right X-`";
    case "GP_RS_RIGHT": return "`Right X+`";
    case "GP_RS_UP": return "`Right Y+`";
    case "GP_RS_DOWN": return "`Right Y-`";
    default: return null;
  }

  if (learnedBinds && platform === "darwin") {
    const sdlBtn = TOK_TO_SDL3_BUTTON[tok];
    if (sdlBtn != null) {
      const binding = learnedBinds[`button_${sdlBtn}`];
      if (binding && binding.button !== -1) {
        expr = `${expr} | \`Button ${binding.button}\``;
      }
    }
  }
  
  return expr;
}
export function detectDolphinPadDevice(configDir: string): string | null {
  try {
    const fs = require("fs");
    const p = path.join(configDir, "GCPadNew.ini");
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      const match = content.match(/^Device\s*=\s*(.+)$/m);
      if (match) return match[1].trim();
    }
  } catch (err) {}
  return null;
}

export function getPlatformGamepadDevice(
  platform: string = "win32",
  deviceIndex = 0,
  preferredControllerId?: string
): { deviceString: string; learnedBinds?: any } {
  console.log(`[Dolphin] getPlatformGamepadDevice called with platform=${platform}, deviceIndex=${deviceIndex}, preferredControllerId=${preferredControllerId}`);
  if (preferredControllerId && preferredControllerId !== "auto") {

    let deviceString = preferredControllerId;
    if (platform === "darwin") {
      if (deviceString.includes("DualSense Wireless Controller")) {
        deviceString = deviceString.replace("DualSense Wireless Controller", "PS5 Controller");
      } else if (deviceString.includes("DualShock 4 Wireless Controller")) {
        deviceString = deviceString.replace("DualShock 4 Wireless Controller", "PS4 Controller");
      }
    }
    return { deviceString };
  }
  if (platform === "win32") return { deviceString: preferredControllerId ?? `XInput/${deviceIndex}/Gamepad` };

  if (platform === "darwin") {
    try {
      let helperPath = path.join(app.getAppPath(), "bin/mac/sdl3probe-macos");
      if (app.isPackaged) {
        helperPath = path.join(process.resourcesPath, "bin/mac/sdl3probe-macos");
      } else {
        const fs = require('fs');
        const altPath = path.join(process.cwd(), "bin/mac/sdl3probe-macos");
        if (fs.existsSync(altPath)) helperPath = altPath;
      }
      const res = spawnSync(helperPath, [], { encoding: "utf8", timeout: 1500 });
      if (res.stdout) {
        const parsed = JSON.parse(res.stdout);
        if (parsed.ok && parsed.name) {
          let deviceName = parsed.name;
          // normalize sdl3 names to dolphin 2407's sdl2 names on mac
          if (platform === "darwin") {
            if (deviceName === "DualSense Wireless Controller") deviceName = "PS5 Controller";
            else if (deviceName === "DualShock 4 Wireless Controller") deviceName = "PS4 Controller";
          }
          return { deviceString: `SDL/${parsed.port}/${deviceName}`, learnedBinds: parsed.binds };
        }
      }
    } catch (e) {
      console.error("Failed to run sdl3probe", e);
    }
    return { deviceString: preferredControllerId ?? `SDL/${deviceIndex}/Gamepad` };
  }
  
  return { deviceString: preferredControllerId ?? `evdev/${deviceIndex}/Gamepad` };
}