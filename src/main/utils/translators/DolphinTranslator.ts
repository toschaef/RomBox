import path from "path";
import type { IEmulatorTranslator, TranslateContext, EmulatorPatch } from "./ITranslator";
import type { ControlsProfile, DigitalBinding } from "../../../shared/types/controls";
import { axisToDigitalToken } from "../../../shared/controls/gamepadTokens";
import { getDirFromDpad, getDirFromLook, getDirFromMove } from "../profileRead";
import { DOLPHIN, dolphinExprForGamepadToken, getPlatformGamepadDevice, detectDolphinPadDevice } from "../schema/dolphin";
import { KeycodeMapper } from "../keycodes/KeycodeMapper";


type DolphinConsole = "gc" | "wii";
type DeviceKind = "keyboard" | "gamepad";

function pickConsole(ctx: TranslateContext): DolphinConsole {
  return ctx.consoleId === "wii" ? "wii" : "gc";
}

function detectDeviceKindFromProfile(profile: ControlsProfile): DeviceKind {
  const all: DigitalBinding[] = [];
  const p1 = profile.player1;

  const push = (b?: DigitalBinding) => {
    if (b) all.push(b);
  };

  push(p1.face?.primary);
  push(p1.face?.secondary);
  push(p1.face?.tertiary);
  push(p1.face?.quaternary);

  push(p1.shoulders?.bumperL);
  push(p1.shoulders?.bumperR);
  push(p1.shoulders?.triggerL);
  push(p1.shoulders?.triggerR);

  push(p1.system?.start);
  push(p1.system?.select);

  push(p1.dpad?.up);
  push(p1.dpad?.down);
  push(p1.dpad?.left);
  push(p1.dpad?.right);

  const move = p1.move;
  if (move && move.type === "dpad") {
    push(move.up);
    push(move.down);
    push(move.left);
    push(move.right);
  }

  const look = p1.look;
  if (look && look.type === "dpad") {
    push(look.up);
    push(look.down); 
    push(look.left);
    push(look.right);
  }

  const special = p1.special;
  if (special && special.type === "wii") {
    // push(special.nunchuckC);
    // push(special.nunchuckZ);
    push(special.home);
  }

  let sawGp = false;
  let sawKey = false;

  for (const b of all) {
    if (b.type === "gp_button" || b.type === "gp_axis_digital") sawGp = true;
    if (b.type === "key") sawKey = true;
  }

  if (sawGp) return "gamepad";
  if (sawKey) return "keyboard";
  return "keyboard";
}

function needsBackticks(tok: string) {
  return /[\s()&|!`]/.test(tok);
}

function wrapTok(tok: string) {
  return needsBackticks(tok) ? `\`${tok}\`` : tok;
}

function getSDLDeviceIndex(ctx?: TranslateContext, profile?: ControlsProfile): number {
  if (ctx?.deviceIndex !== undefined) return ctx.deviceIndex;
  if (ctx?.padPort !== undefined) return Math.max(0, ctx.padPort - 1);
  return 0; // fallback default
}



function dolphinExprForDigital(
  b: DigitalBinding,
  kind: DeviceKind,
  platform: TranslateContext["platform"] = "win32",
  learnedBinds?: any
): string | null {
  if (kind === "gamepad") {
    if (b.type === "gp_button") return dolphinExprForGamepadToken(b.token, platform, learnedBinds);
    if (b.type === "gp_axis_digital") {
      const tok = axisToDigitalToken({
        stick: b.stick,
        axis: b.axis,
        sign: b.dir === "neg" ? -1 : 1,
      });
      return tok ? dolphinExprForGamepadToken(tok, platform, learnedBinds) : null;
    }
    return null;
  }
  
  if (b.type !== "key") return null;
  const mapped = KeycodeMapper.toKeycode("dolphin", b.code, platform);
  const key = typeof mapped === "string" ? mapped : b.code;
  return wrapTok(key);
}

function pickDeviceString(profile: ControlsProfile, kind: DeviceKind, platform: TranslateContext["platform"]): string | null {
  if (kind === "keyboard") {
    if (platform === "darwin") return DOLPHIN.MAC_QUARTZ_DEVICE;
    return profile.preferredControllerId ?? "DInput/0/Keyboard Mouse";
  }

  if (profile.preferredControllerId) return profile.preferredControllerId;

  return null;
}

function addIniPatch(
  patches: EmulatorPatch[],
  absPath: string,
  section: string,
  key: string,
  value: string
) {
  patches.push({ kind: "ini-set", absPath, section, key, value });
}

export class DolphinTranslator implements IEmulatorTranslator {
  id = "dolphin";

  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[] {
    if (!ctx.configDir) throw new Error("DolphinTranslator requires ctx.configDir");

    const which = pickConsole(ctx);
    const kind = detectDeviceKindFromProfile(profile);

    const deviceIndex = getSDLDeviceIndex(ctx, profile);
    const info = getPlatformGamepadDevice(ctx.platform, deviceIndex, profile.preferredControllerId);
    if (ctx) ctx.learnedBinds = info.learnedBinds;
    
    let device = info.deviceString;
    if (kind === "gamepad" && ctx.learnedDevice) {
      device = ctx.learnedDevice;
    } else if (ctx.configDir) {
      const detected = detectDolphinPadDevice(ctx.configDir);
      if (detected) {
        if (
          (kind === "gamepad" && detected.includes("Keyboard")) ||
          (kind === "keyboard" && !detected.includes("Keyboard"))
        ) {
          console.log(`[DolphinTranslator] Ignoring cached fallback device: ${detected}`);
        } else {
          console.log(`[DolphinTranslator] Using detected device from config: ${detected}`);
          device = detected;
        }
      }
    }
    const patches: EmulatorPatch[] = [];

    const gcNew = DOLPHIN.gcPadNewPath(ctx.configDir);
    const wiiNew = DOLPHIN.wiimoteNewPath(ctx.configDir);

    const writeBinding = (absPath: string, section: string, label: string, b?: DigitalBinding) => {
      if (!b) return;
      if (kind === "gamepad" && !device) return;

      const expr = dolphinExprForDigital(b, kind === "gamepad" && device ? "gamepad" : "keyboard", ctx.platform, ctx.learnedBinds);
      if (!expr) return;

      addIniPatch(patches, absPath, section, label, expr);
    };

    const writeClassic = (label: string, b?: DigitalBinding) =>
      writeBinding(wiiNew, "Wiimote1", label, b);

    const effectiveKind: DeviceKind = kind === "gamepad" && !device ? "keyboard" : kind;
    const effectiveDevice =
      effectiveKind === "keyboard"
        ? (ctx.platform === "darwin" ? DOLPHIN.MAC_QUARTZ_DEVICE : "DInput/0/Keyboard Mouse")
        : (device as string);

    addIniPatch(patches, gcNew, "GCPad1", "Device", effectiveDevice);

    writeBinding(gcNew, "GCPad1", "Buttons/A", profile.player1.face.primary);
    writeBinding(gcNew, "GCPad1", "Buttons/B", profile.player1.face.secondary);
    writeBinding(gcNew, "GCPad1", "Buttons/X", profile.player1.face.tertiary);
    writeBinding(gcNew, "GCPad1", "Buttons/Y", profile.player1.face.quaternary);
    writeBinding(gcNew, "GCPad1", "Buttons/Start", profile.player1.system.start);

    writeBinding(gcNew, "GCPad1", "Triggers/L", profile.player1.shoulders.bumperL);
    writeBinding(gcNew, "GCPad1", "Triggers/R", profile.player1.shoulders.bumperR);
    writeBinding(gcNew, "GCPad1", "Triggers/L-Analog", profile.player1.shoulders.triggerL);
    writeBinding(gcNew, "GCPad1", "Triggers/R-Analog", profile.player1.shoulders.triggerR);

    writeBinding(gcNew, "GCPad1", "D-Pad/Up", getDirFromDpad(profile, "up"));
    writeBinding(gcNew, "GCPad1", "D-Pad/Down", getDirFromDpad(profile, "down"));
    writeBinding(gcNew, "GCPad1", "D-Pad/Left", getDirFromDpad(profile, "left"));
    writeBinding(gcNew, "GCPad1", "D-Pad/Right", getDirFromDpad(profile, "right"));

    writeBinding(gcNew, "GCPad1", "Main Stick/Up", getDirFromMove(profile, "up"));
    writeBinding(gcNew, "GCPad1", "Main Stick/Down", getDirFromMove(profile, "down"));
    writeBinding(gcNew, "GCPad1", "Main Stick/Left", getDirFromMove(profile, "left"));
    writeBinding(gcNew, "GCPad1", "Main Stick/Right", getDirFromMove(profile, "right"));

    const special = profile.player1.special;
    const gcC = special?.type === "n64" ? special.c : undefined;

    const cUp = gcC?.type === "dpad" ? gcC.up : undefined;
    const cDown = gcC?.type === "dpad" ? gcC.down : undefined;
    const cLeft = gcC?.type === "dpad" ? gcC.left : undefined;
    const cRight = gcC?.type === "dpad" ? gcC.right : undefined;

    if (which === "gc") {
      writeBinding(gcNew, "GCPad1", "C-Stick/Up", cUp ?? getDirFromLook(profile, "up"));
      writeBinding(gcNew, "GCPad1", "C-Stick/Down", cDown ?? getDirFromLook(profile, "down"));
      writeBinding(gcNew, "GCPad1", "C-Stick/Left", cLeft ?? getDirFromLook(profile, "left"));
      writeBinding(gcNew, "GCPad1", "C-Stick/Right", cRight ?? getDirFromLook(profile, "right"));
    } else {
      writeBinding(gcNew, "GCPad1", "C-Stick/Up", getDirFromLook(profile, "up"));
      writeBinding(gcNew, "GCPad1", "C-Stick/Down", getDirFromLook(profile, "down"));
      writeBinding(gcNew, "GCPad1", "C-Stick/Left", getDirFromLook(profile, "left"));
      writeBinding(gcNew, "GCPad1", "C-Stick/Right", getDirFromLook(profile, "right"));
    }

    const zBinding = special?.type === "n64" || special?.type === "gc" ? special.z : undefined;
    writeBinding(gcNew, "GCPad1", "Buttons/Z", zBinding);

    if (which === "wii") {
      addIniPatch(patches, wiiNew, "Wiimote1", "Device", effectiveDevice);
      addIniPatch(patches, wiiNew, "Wiimote1", "Extension", "Classic");

      // --- Classic Controller ---
      writeClassic("Classic/Buttons/A", profile.player1.face.primary);
      writeClassic("Classic/Buttons/B", profile.player1.face.secondary);
      writeClassic("Classic/Buttons/X", profile.player1.face.tertiary);
      writeClassic("Classic/Buttons/Y", profile.player1.face.quaternary);

      writeClassic("Classic/Buttons/+", profile.player1.system.start);
      writeClassic("Classic/Buttons/-", profile.player1.system.select);
      
      const wiiSpecial = special?.type === "wii" ? special : undefined;
      
      if (wiiSpecial?.home) {
        writeClassic("Classic/Buttons/Home", wiiSpecial.home);
      }

      writeClassic("Classic/D-Pad/Up", getDirFromDpad(profile, "up"));
      writeClassic("Classic/D-Pad/Down", getDirFromDpad(profile, "down"));
      writeClassic("Classic/D-Pad/Left", getDirFromDpad(profile, "left"));
      writeClassic("Classic/D-Pad/Right", getDirFromDpad(profile, "right"));

      writeClassic("Classic/Left Stick/Up", getDirFromMove(profile, "up"));
      writeClassic("Classic/Left Stick/Down", getDirFromMove(profile, "down"));
      writeClassic("Classic/Left Stick/Left", getDirFromMove(profile, "left"));
      writeClassic("Classic/Left Stick/Right", getDirFromMove(profile, "right"));

      writeClassic("Classic/Right Stick/Up", getDirFromLook(profile, "up"));
      writeClassic("Classic/Right Stick/Down", getDirFromLook(profile, "down"));
      writeClassic("Classic/Right Stick/Left", getDirFromLook(profile, "left"));
      writeClassic("Classic/Right Stick/Right", getDirFromLook(profile, "right"));

      writeClassic("Classic/Triggers/L", profile.player1.shoulders.bumperL);
      writeClassic("Classic/Triggers/R", profile.player1.shoulders.bumperR);
      writeClassic("Classic/Buttons/ZL", profile.player1.shoulders.triggerL);
      writeClassic("Classic/Buttons/ZR", profile.player1.shoulders.triggerR);

      // wiimote fallback
      if (wiiSpecial) {
        writeBinding(wiiNew, "Wiimote1", "Buttons/A", wiiSpecial.wiimoteA);
        writeBinding(wiiNew, "Wiimote1", "Buttons/B", wiiSpecial.wiimoteB);
        writeBinding(wiiNew, "Wiimote1", "Buttons/1", wiiSpecial.wiimote1);
        writeBinding(wiiNew, "Wiimote1", "Buttons/2", wiiSpecial.wiimote2);
        writeBinding(wiiNew, "Wiimote1", "Buttons/+", wiiSpecial.wiimotePlus);
        writeBinding(wiiNew, "Wiimote1", "Buttons/-", wiiSpecial.wiimoteMinus);
        writeBinding(wiiNew, "Wiimote1", "Buttons/Home", wiiSpecial.wiimoteHome);

        writeBinding(wiiNew, "Wiimote1", "D-Pad/Up", wiiSpecial.wiimoteDpad?.up);
        writeBinding(wiiNew, "Wiimote1", "D-Pad/Down", wiiSpecial.wiimoteDpad?.down);
        writeBinding(wiiNew, "Wiimote1", "D-Pad/Left", wiiSpecial.wiimoteDpad?.left);
        writeBinding(wiiNew, "Wiimote1", "D-Pad/Right", wiiSpecial.wiimoteDpad?.right);

        // nunchuck
        writeBinding(wiiNew, "Wiimote1", "Nunchuk/Buttons/C", wiiSpecial.nunchuckC);
        writeBinding(wiiNew, "Wiimote1", "Nunchuk/Buttons/Z", wiiSpecial.nunchuckZ);

        // motion / ir
        writeBinding(wiiNew, "Wiimote1", "Shake/X", wiiSpecial.shake);
        writeBinding(wiiNew, "Wiimote1", "Shake/Y", wiiSpecial.shake);
        writeBinding(wiiNew, "Wiimote1", "Shake/Z", wiiSpecial.shake);

        if (wiiSpecial.tilt?.type === "stick") {
          writeBinding(wiiNew, "Wiimote1", "Tilt/Forward", { type: "gp_axis_digital", stick: wiiSpecial.tilt.stick, axis: "y", dir: "neg", threshold: 0.5 });
          writeBinding(wiiNew, "Wiimote1", "Tilt/Backward", { type: "gp_axis_digital", stick: wiiSpecial.tilt.stick, axis: "y", dir: "pos", threshold: 0.5 });
          writeBinding(wiiNew, "Wiimote1", "Tilt/Left", { type: "gp_axis_digital", stick: wiiSpecial.tilt.stick, axis: "x", dir: "neg", threshold: 0.5 });
          writeBinding(wiiNew, "Wiimote1", "Tilt/Right", { type: "gp_axis_digital", stick: wiiSpecial.tilt.stick, axis: "x", dir: "pos", threshold: 0.5 });
        } else if (wiiSpecial.tilt?.type === "dpad") {
          writeBinding(wiiNew, "Wiimote1", "Tilt/Forward", wiiSpecial.tilt.up);
          writeBinding(wiiNew, "Wiimote1", "Tilt/Backward", wiiSpecial.tilt.down);
          writeBinding(wiiNew, "Wiimote1", "Tilt/Left", wiiSpecial.tilt.left);
          writeBinding(wiiNew, "Wiimote1", "Tilt/Right", wiiSpecial.tilt.right);
        }

        if (wiiSpecial.ir?.type === "stick") {
          writeBinding(wiiNew, "Wiimote1", "IR/Up", { type: "gp_axis_digital", stick: wiiSpecial.ir.stick, axis: "y", dir: "neg", threshold: 0.5 });
          writeBinding(wiiNew, "Wiimote1", "IR/Down", { type: "gp_axis_digital", stick: wiiSpecial.ir.stick, axis: "y", dir: "pos", threshold: 0.5 });
          writeBinding(wiiNew, "Wiimote1", "IR/Left", { type: "gp_axis_digital", stick: wiiSpecial.ir.stick, axis: "x", dir: "neg", threshold: 0.5 });
          writeBinding(wiiNew, "Wiimote1", "IR/Right", { type: "gp_axis_digital", stick: wiiSpecial.ir.stick, axis: "x", dir: "pos", threshold: 0.5 });
        } else if (wiiSpecial.ir?.type === "dpad") {
          writeBinding(wiiNew, "Wiimote1", "IR/Up", wiiSpecial.ir.up);
          writeBinding(wiiNew, "Wiimote1", "IR/Down", wiiSpecial.ir.down);
          writeBinding(wiiNew, "Wiimote1", "IR/Left", wiiSpecial.ir.left);
          writeBinding(wiiNew, "Wiimote1", "IR/Right", wiiSpecial.ir.right);
        }
      }
    }

    if (ctx.gameId) {
      const gameIni = path.join(ctx.configDir, "GameSettings", `${ctx.gameId}.ini`);

      addIniPatch(patches, gameIni, "Controls", "PadType0", "6");
    }

    return patches;
  }
}