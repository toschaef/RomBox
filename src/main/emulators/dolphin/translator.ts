import type { IEmulatorTranslator, TranslateContext, EmulatorPatch, LearnedBinds } from "../translatorTypes";
import type { ControlsProfile, DigitalBinding } from "../../../shared/types/controls";
import { axisToDigitalToken } from "../../../shared/controls/gamepadTokens";
import { getDirFromDpad, getDirFromLook, getDirFromMove } from "../../utils/profileRead";
import { DOLPHIN, dolphinExprForGamepadToken, getPlatformGamepadDevice } from "./schema";
import { KeycodeMapper } from "../../utils/keycodes/KeycodeMapper";
import { getPlayerControllerId, getDefaultControllerId } from "../../../shared/controls/controllerModels";


type DolphinConsole = "gc" | "wii";
type DeviceKind = "keyboard" | "gamepad";

function pickConsole(ctx: TranslateContext): DolphinConsole {
  return ctx.consoleId === "wii" ? "wii" : "gc";
}

function detectDeviceKindFromProfile(p1?: import("../../../shared/types/controls").PlayerBindings): DeviceKind {
  if (!p1) return "keyboard";
  const all: DigitalBinding[] = [];

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

function dolphinExprForDigital(
  b: DigitalBinding,
  kind: DeviceKind,
  platform: TranslateContext["platform"] = "win32",
  learnedBinds?: LearnedBinds
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

function addIniPatch(
  patches: EmulatorPatch[],
  absPath: string,
  section: string,
  key: string,
  value: string
) {
  patches.push({ kind: "ini-set", absPath, section, key, value });
}

const WIIMOTE_ONLY_KEYS = [
  "Buttons/A", "Buttons/B", "Buttons/1", "Buttons/2", "Buttons/+", "Buttons/-", "Buttons/Home",
  "D-Pad/Up", "D-Pad/Down", "D-Pad/Left", "D-Pad/Right",
  "Nunchuk/Buttons/C", "Nunchuk/Buttons/Z",
  "Shake/X", "Shake/Y", "Shake/Z",
  "Tilt/Forward", "Tilt/Backward", "Tilt/Left", "Tilt/Right",
  "IR/Up", "IR/Down", "IR/Left", "IR/Right",
];

export class DolphinTranslator implements IEmulatorTranslator {
  id = "dolphin";

  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[] {
    const patches: EmulatorPatch[] = [];

    const which = pickConsole(ctx);
    const players = [
      { key: "player1" as const, gcPad: "GCPad1", wiimote: "Wiimote1" },
      { key: "player2" as const, gcPad: "GCPad2", wiimote: "Wiimote2" },
      { key: "player3" as const, gcPad: "GCPad3", wiimote: "Wiimote3" },
      { key: "player4" as const, gcPad: "GCPad4", wiimote: "Wiimote4" },
    ];

    let gamepadOrdinal = 0;

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!profile[p.key]) continue;
      const playerKey = p.key;
      const kind = detectDeviceKindFromProfile(profile[playerKey]);
      const deviceIndex = kind === "gamepad" ? gamepadOrdinal++ : 0;

      let device: string | undefined;
      let learnedBinds: LearnedBinds | undefined;
      if (kind === "gamepad") {
        const preferredForPlayer = deviceIndex === 0 ? profile.preferredControllerId : undefined;
        const info = getPlatformGamepadDevice(ctx.platform, deviceIndex, preferredForPlayer);

        learnedBinds = info.learnedBinds;
        if (deviceIndex === 0) ctx.learnedBinds = info.learnedBinds;

        device = info.deviceString;
        if (ctx.learnedDevice && deviceIndex === 0) {
          device = ctx.learnedDevice;
        }
      }

      const gcNew = DOLPHIN.gcPadNewPath(ctx.configDir);
      const wiiNew = DOLPHIN.wiimoteNewPath(ctx.configDir);

      const writeBinding = (absPath: string, section: string, label: string, b?: DigitalBinding) => {
        if (!b) return;
        if (kind === "gamepad" && !device) return;

        const expr = dolphinExprForDigital(b, kind === "gamepad" && device ? "gamepad" : "keyboard", ctx.platform, learnedBinds);
        if (!expr) return;

        addIniPatch(patches, absPath, section, label, expr);
      };

      const writeClassic = (label: string, b?: DigitalBinding) =>
        writeBinding(wiiNew, p.wiimote, label, b);

      const effectiveKind: DeviceKind = kind === "gamepad" && !device ? "keyboard" : kind;
      const effectiveDevice =
        effectiveKind === "keyboard"
          ? (ctx.platform === "darwin" ? DOLPHIN.MAC_QUARTZ_DEVICE : "DInput/0/Keyboard Mouse")
          : (device as string);

      addIniPatch(patches, gcNew, p.gcPad, "Device", effectiveDevice);

      writeBinding(gcNew, p.gcPad, "Buttons/A", profile[playerKey]?.face?.primary);
      writeBinding(gcNew, p.gcPad, "Buttons/B", profile[playerKey]?.face?.secondary);
      writeBinding(gcNew, p.gcPad, "Buttons/X", profile[playerKey]?.face?.tertiary);
      writeBinding(gcNew, p.gcPad, "Buttons/Y", profile[playerKey]?.face?.quaternary);
      writeBinding(gcNew, p.gcPad, "Buttons/Start", profile[playerKey]?.system?.start);

      writeBinding(gcNew, p.gcPad, "Triggers/L", profile[playerKey]?.shoulders?.bumperL);
      writeBinding(gcNew, p.gcPad, "Triggers/R", profile[playerKey]?.shoulders?.bumperR);
      writeBinding(gcNew, p.gcPad, "Triggers/L-Analog", profile[playerKey]?.shoulders?.triggerL);
      writeBinding(gcNew, p.gcPad, "Triggers/R-Analog", profile[playerKey]?.shoulders?.triggerR);

      writeBinding(gcNew, p.gcPad, "D-Pad/Up", getDirFromDpad(profile, playerKey, "up"));
      writeBinding(gcNew, p.gcPad, "D-Pad/Down", getDirFromDpad(profile, playerKey, "down"));
      writeBinding(gcNew, p.gcPad, "D-Pad/Left", getDirFromDpad(profile, playerKey, "left"));
      writeBinding(gcNew, p.gcPad, "D-Pad/Right", getDirFromDpad(profile, playerKey, "right"));

      writeBinding(gcNew, p.gcPad, "Main Stick/Up", getDirFromMove(profile, playerKey, "up"));
      writeBinding(gcNew, p.gcPad, "Main Stick/Down", getDirFromMove(profile, playerKey, "down"));
      writeBinding(gcNew, p.gcPad, "Main Stick/Left", getDirFromMove(profile, playerKey, "left"));
      writeBinding(gcNew, p.gcPad, "Main Stick/Right", getDirFromMove(profile, playerKey, "right"));

      const special = profile[playerKey]?.special;
      const gcC = special?.type === "n64" ? special.c : undefined;

      const cUp = gcC?.type === "dpad" ? gcC.up : undefined;
      const cDown = gcC?.type === "dpad" ? gcC.down : undefined;
      const cLeft = gcC?.type === "dpad" ? gcC.left : undefined;
      const cRight = gcC?.type === "dpad" ? gcC.right : undefined;

      if (which === "gc") {
        writeBinding(gcNew, p.gcPad, "C-Stick/Up", cUp ?? getDirFromLook(profile, playerKey, "up"));
        writeBinding(gcNew, p.gcPad, "C-Stick/Down", cDown ?? getDirFromLook(profile, playerKey, "down"));
        writeBinding(gcNew, p.gcPad, "C-Stick/Left", cLeft ?? getDirFromLook(profile, playerKey, "left"));
        writeBinding(gcNew, p.gcPad, "C-Stick/Right", cRight ?? getDirFromLook(profile, playerKey, "right"));
      } else {
        writeBinding(gcNew, p.gcPad, "C-Stick/Up", getDirFromLook(profile, playerKey, "up"));
        writeBinding(gcNew, p.gcPad, "C-Stick/Down", getDirFromLook(profile, playerKey, "down"));
        writeBinding(gcNew, p.gcPad, "C-Stick/Left", getDirFromLook(profile, playerKey, "left"));
        writeBinding(gcNew, p.gcPad, "C-Stick/Right", getDirFromLook(profile, playerKey, "right"));
      }

      const zBinding = special?.type === "n64" || special?.type === "gc" ? special.z : undefined;
      writeBinding(gcNew, p.gcPad, "Buttons/Z", zBinding);

      if (which === "wii") {
        addIniPatch(patches, wiiNew, p.wiimote, "Device", effectiveDevice);

        const playerControllerId = getPlayerControllerId(ctx, playerKey) ?? getDefaultControllerId("wii");

        let extension = "Classic";
        let sideways = "False";
        if (playerControllerId === "wiimote_nunchuk") extension = "Nunchuk";
        if (playerControllerId === "wiimote" || playerControllerId === "wiimote_sideways") extension = "None";
        if (playerControllerId === "wiimote_sideways") sideways = "True";

        addIniPatch(patches, wiiNew, p.wiimote, "Extension", extension);
        addIniPatch(patches, wiiNew, p.wiimote, "Options/Sideways Wiimote", sideways);

        const pb = profile[playerKey];
        const wiiSpecial = special?.type === "wii" ? special : undefined;

        const isWiimoteFamily = extension === "None" || extension === "Nunchuk";

        if (!isWiimoteFamily) {
          writeClassic("Classic/Buttons/A", pb?.face?.primary);
          writeClassic("Classic/Buttons/B", pb?.face?.secondary);
          writeClassic("Classic/Buttons/X", pb?.face?.tertiary);
          writeClassic("Classic/Buttons/Y", pb?.face?.quaternary);

          writeClassic("Classic/Buttons/+", pb?.system?.start);
          writeClassic("Classic/Buttons/-", pb?.system?.select);

          if (wiiSpecial?.home) {
            writeClassic("Classic/Buttons/Home", wiiSpecial.home);
          }

          writeClassic("Classic/D-Pad/Up", getDirFromDpad(profile, playerKey, "up"));
          writeClassic("Classic/D-Pad/Down", getDirFromDpad(profile, playerKey, "down"));
          writeClassic("Classic/D-Pad/Left", getDirFromDpad(profile, playerKey, "left"));
          writeClassic("Classic/D-Pad/Right", getDirFromDpad(profile, playerKey, "right"));

          writeClassic("Classic/Left Stick/Up", getDirFromMove(profile, playerKey, "up"));
          writeClassic("Classic/Left Stick/Down", getDirFromMove(profile, playerKey, "down"));
          writeClassic("Classic/Left Stick/Left", getDirFromMove(profile, playerKey, "left"));
          writeClassic("Classic/Left Stick/Right", getDirFromMove(profile, playerKey, "right"));

          writeClassic("Classic/Right Stick/Up", getDirFromLook(profile, playerKey, "up"));
          writeClassic("Classic/Right Stick/Down", getDirFromLook(profile, playerKey, "down"));
          writeClassic("Classic/Right Stick/Left", getDirFromLook(profile, playerKey, "left"));
          writeClassic("Classic/Right Stick/Right", getDirFromLook(profile, playerKey, "right"));

          writeClassic("Classic/Triggers/L", pb?.shoulders?.bumperL);
          writeClassic("Classic/Triggers/R", pb?.shoulders?.bumperR);
          writeClassic("Classic/Buttons/ZL", pb?.shoulders?.triggerL);
          writeClassic("Classic/Buttons/ZR", pb?.shoulders?.triggerR);
        } else {
          writeBinding(wiiNew, p.wiimote, "Buttons/A", wiiSpecial?.wiimoteA ?? pb?.face?.primary);
          writeBinding(wiiNew, p.wiimote, "Buttons/B", wiiSpecial?.wiimoteB ?? pb?.face?.secondary);
          writeBinding(wiiNew, p.wiimote, "Buttons/1", wiiSpecial?.wiimote1 ?? pb?.face?.tertiary);
          writeBinding(wiiNew, p.wiimote, "Buttons/2", wiiSpecial?.wiimote2 ?? pb?.face?.quaternary);
          writeBinding(wiiNew, p.wiimote, "Buttons/+", wiiSpecial?.wiimotePlus ?? pb?.system?.start);
          writeBinding(wiiNew, p.wiimote, "Buttons/-", wiiSpecial?.wiimoteMinus ?? pb?.system?.select);
          writeBinding(wiiNew, p.wiimote, "Buttons/Home", wiiSpecial?.wiimoteHome ?? wiiSpecial?.home);

          const wmDpad = wiiSpecial?.wiimoteDpad;
          writeBinding(wiiNew, p.wiimote, "D-Pad/Up", wmDpad?.up ?? getDirFromDpad(profile, playerKey, "up"));
          writeBinding(wiiNew, p.wiimote, "D-Pad/Down", wmDpad?.down ?? getDirFromDpad(profile, playerKey, "down"));
          writeBinding(wiiNew, p.wiimote, "D-Pad/Left", wmDpad?.left ?? getDirFromDpad(profile, playerKey, "left"));
          writeBinding(wiiNew, p.wiimote, "D-Pad/Right", wmDpad?.right ?? getDirFromDpad(profile, playerKey, "right"));

          if (extension === "Nunchuk") {
            writeBinding(wiiNew, p.wiimote, "Nunchuk/Buttons/C", wiiSpecial?.nunchuckC);
            writeBinding(wiiNew, p.wiimote, "Nunchuk/Buttons/Z", wiiSpecial?.nunchuckZ);

            writeBinding(wiiNew, p.wiimote, "Nunchuk/Stick/Up", getDirFromMove(profile, playerKey, "up"));
            writeBinding(wiiNew, p.wiimote, "Nunchuk/Stick/Down", getDirFromMove(profile, playerKey, "down"));
            writeBinding(wiiNew, p.wiimote, "Nunchuk/Stick/Left", getDirFromMove(profile, playerKey, "left"));
            writeBinding(wiiNew, p.wiimote, "Nunchuk/Stick/Right", getDirFromMove(profile, playerKey, "right"));
          }
        }

        if (wiiSpecial && isWiimoteFamily) {
          // motion / ir
          writeBinding(wiiNew, p.wiimote, "Shake/X", wiiSpecial.shake);
          writeBinding(wiiNew, p.wiimote, "Shake/Y", wiiSpecial.shake);
          writeBinding(wiiNew, p.wiimote, "Shake/Z", wiiSpecial.shake);

          if (wiiSpecial.tilt?.type === "stick") {
            writeBinding(wiiNew, p.wiimote, "Tilt/Forward", { type: "gp_axis_digital", stick: wiiSpecial.tilt.stick, axis: "y", dir: "neg", threshold: 0.5 });
            writeBinding(wiiNew, p.wiimote, "Tilt/Backward", { type: "gp_axis_digital", stick: wiiSpecial.tilt.stick, axis: "y", dir: "pos", threshold: 0.5 });
            writeBinding(wiiNew, p.wiimote, "Tilt/Left", { type: "gp_axis_digital", stick: wiiSpecial.tilt.stick, axis: "x", dir: "neg", threshold: 0.5 });
            writeBinding(wiiNew, p.wiimote, "Tilt/Right", { type: "gp_axis_digital", stick: wiiSpecial.tilt.stick, axis: "x", dir: "pos", threshold: 0.5 });
          } else if (wiiSpecial.tilt?.type === "dpad") {
            writeBinding(wiiNew, p.wiimote, "Tilt/Forward", wiiSpecial.tilt.up);
            writeBinding(wiiNew, p.wiimote, "Tilt/Backward", wiiSpecial.tilt.down);
            writeBinding(wiiNew, p.wiimote, "Tilt/Left", wiiSpecial.tilt.left);
            writeBinding(wiiNew, p.wiimote, "Tilt/Right", wiiSpecial.tilt.right);
          }

          if (wiiSpecial.ir?.type === "stick") {
            writeBinding(wiiNew, p.wiimote, "IR/Up", { type: "gp_axis_digital", stick: wiiSpecial.ir.stick, axis: "y", dir: "neg", threshold: 0.5 });
            writeBinding(wiiNew, p.wiimote, "IR/Down", { type: "gp_axis_digital", stick: wiiSpecial.ir.stick, axis: "y", dir: "pos", threshold: 0.5 });
            writeBinding(wiiNew, p.wiimote, "IR/Left", { type: "gp_axis_digital", stick: wiiSpecial.ir.stick, axis: "x", dir: "neg", threshold: 0.5 });
            writeBinding(wiiNew, p.wiimote, "IR/Right", { type: "gp_axis_digital", stick: wiiSpecial.ir.stick, axis: "x", dir: "pos", threshold: 0.5 });
          } else if (wiiSpecial.ir?.type === "dpad") {
            writeBinding(wiiNew, p.wiimote, "IR/Up", wiiSpecial.ir.up);
            writeBinding(wiiNew, p.wiimote, "IR/Down", wiiSpecial.ir.down);
            writeBinding(wiiNew, p.wiimote, "IR/Left", wiiSpecial.ir.left);
            writeBinding(wiiNew, p.wiimote, "IR/Right", wiiSpecial.ir.right);
          }
        } else if (!isWiimoteFamily) {
          // clear leftover bindings
          for (const key of WIIMOTE_ONLY_KEYS) {
            addIniPatch(patches, wiiNew, p.wiimote, key, "");
          }
        }
      }
    }

    return patches;
  }
}