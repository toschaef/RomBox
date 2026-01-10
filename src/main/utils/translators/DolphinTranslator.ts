import path from "path";
import type { IEmulatorTranslator, TranslateContext, EmulatorPatch } from "./ITranslator";
import type { ControlsProfile, DigitalBinding } from "../../../shared/types/controls";
import { axisToDigitalToken } from "../../../shared/controls/gamepadTokens";
import { getDirFromDpad, getDirFromLook, getDirFromMove } from "../profileRead";
import { DOLPHIN, quartzKeyFromDomCode, dolphinExprForGamepadToken } from "../schema/dolphin";


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

  const move = (p1 as any).move;
  if (move && move.type === "dpad") {
    push(move.up);
    push(move.down);
    push(move.left);
    push(move.right);
  }

  const look = (p1 as any).look;
  if (look && look.type === "dpad") {
    push(look.up);
    push(look.down);
    push(look.left);
    push(look.right);
  }

  const special = (p1 as any).special;
  if (special && special.type === "wii") {
    push(special.nunchuckC);
    push(special.nunchuckZ);
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

function dolphinExprForDigital(b: DigitalBinding, kind: DeviceKind): string | null {
  if (kind === "gamepad") {
    if (b.type === "gp_button") return dolphinExprForGamepadToken(b.token);
    if (b.type === "gp_axis_digital") {
      const tok = axisToDigitalToken({
        stick: b.stick,
        axis: b.axis,
        sign: b.dir === "neg" ? -1 : 1,
      });
      return dolphinExprForGamepadToken(tok);
    }
    return null;
  }

  if (b.type !== "key") return null;
  const key = quartzKeyFromDomCode(b.code);
  if (!key) return null;

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
    const device = pickDeviceString(profile, kind, ctx.platform);
    const patches: EmulatorPatch[] = [];

    const gcNew = DOLPHIN.gcPadNewPath(ctx.configDir);
    const wiiNew = DOLPHIN.wiimoteNewPath(ctx.configDir);

    const writeBinding = (absPath: string, section: string, label: string, b?: DigitalBinding) => {
      if (!b) return;
      if (kind === "gamepad" && !device) return;

      const expr = dolphinExprForDigital(b, kind === "gamepad" && device ? "gamepad" : "keyboard");
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

    const gcC = profile.player1.c;

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

    writeBinding(gcNew, "GCPad1", "Buttons/Z", profile.player1.z);

    if (which === "wii") {
      addIniPatch(patches, wiiNew, "Wiimote1", "Device", effectiveDevice);
      addIniPatch(patches, wiiNew, "Wiimote1", "Extension", "Classic");

      writeClassic("Classic/Buttons/A", profile.player1.face.primary);
      writeClassic("Classic/Buttons/B", profile.player1.face.secondary);
      writeClassic("Classic/Buttons/X", profile.player1.face.tertiary);
      writeClassic("Classic/Buttons/Y", profile.player1.face.quaternary);

      writeClassic("Classic/Buttons/+", profile.player1.system.start);
      writeClassic("Classic/Buttons/-", profile.player1.system.select);

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
    }

    if (ctx.gameId) {
      const gameIni = path.join(ctx.configDir, "GameSettings", `${ctx.gameId}.ini`);

      addIniPatch(patches, gameIni, "Controls", "PadType0", "6");
    }

    return patches;
  }
}