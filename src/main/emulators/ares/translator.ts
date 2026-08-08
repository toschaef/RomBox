import type { PlayerBindings, DigitalBinding, ControlsProfile } from "../../../shared/types/controls";
import type { IEmulatorTranslator, EmulatorPatch, TranslateContext } from "../translatorTypes";
import { ARES } from "./schema";
import { pickDir, getDirFromBinding, digitalToGamepadToken } from "../../utils/profileRead";
import type { Platform } from "../../../shared/types";
import { KeycodeMapper } from "../../utils/keycodes/KeycodeMapper";
import type { AzaharLearnedSDL } from "../azahar/sdlProbe";
import { Logger } from "../../utils/logger";

import path from "path";

const log = Logger.create("AresTranslator");

const KEYBOARD_DEVICE_ID = 0x1;
type GamepadBinds = AzaharLearnedSDL["binds"];

function encodeKeyboard(domCode: string, platform: Platform = "darwin"): string | null {
  const mapped = KeycodeMapper.toKeycode("ares", domCode, platform);
  return mapped == null ? null : `0x${KEYBOARD_DEVICE_ID.toString(16)}/0/${mapped};;`;
}

function decodeVendorProductFromGuid(guid: string): { vendorID: number; productID: number } | null {
  if (guid.length < 20) return null;
  const vendorLE = guid.slice(8, 12);
  const productLE = guid.slice(16, 20);
  const vendorID = parseInt(vendorLE.slice(2, 4) + vendorLE.slice(0, 2), 16);
  const productID = parseInt(productLE.slice(2, 4) + productLE.slice(0, 2), 16);
  if (Number.isNaN(vendorID) || Number.isNaN(productID)) return null;
  return { vendorID, productID };
}

function buildGamepadDeviceID(guid: string): string | null {
  const vp = decodeVendorProductFromGuid(guid);
  if (!vp) return null;
  const id = (1n << 32n) | (BigInt(vp.vendorID) << 16n) | BigInt(vp.productID);
  return `0x${id.toString(16)}`;
}

function qualifierFor(dir: "up" | "down" | "left" | "right"): "Lo" | "Hi" {
  return dir === "up" || dir === "left" ? "Lo" : "Hi";
}

function encodeDpadDirection(deviceID: string, dir: "up" | "down" | "left" | "right"): string {
  const inputID = dir === "left" || dir === "right" ? 0 : 1;
  return `${deviceID}/1/${inputID}/${qualifierFor(dir)};;`;
}

function encodeStickDirection(deviceID: string, stick: "left" | "right", dir: "up" | "down" | "left" | "right"): string {
  const base = stick === "left" ? 0 : 2;
  const inputID = base + (dir === "left" || dir === "right" ? 0 : 1);
  return `${deviceID}/0/${inputID}/${qualifierFor(dir)};;`;
}

function encodeGamepadButton(deviceID: string, tok: string, binds?: GamepadBinds): string | null {
  const bind = binds?.[tok];
  if (!bind) return null;
  if (bind.kind === "button") return `${deviceID}/3/${bind.button};;`;
  if (bind.kind === "axis") return `${deviceID}/0/${bind.axis}/${bind.direction === "+" ? "Hi" : "Lo"};;`;
  return null;
}

function encodeGamepad(d: DigitalBinding, deviceID: string | null, binds?: GamepadBinds): string | null {
  if (!deviceID) return null;
  const tok = digitalToGamepadToken(d);
  if (!tok) return null;

  if (tok.startsWith("GP_DPAD_")) {
    const dir = tok.slice("GP_DPAD_".length).toLowerCase() as "up" | "down" | "left" | "right";
    return encodeDpadDirection(deviceID, dir);
  }
  if (tok.startsWith("GP_LS_") || tok.startsWith("GP_RS_")) {
    const probed = encodeGamepadButton(deviceID, tok, binds);
    if (probed) return probed;
    const stick = tok.startsWith("GP_LS_") ? "left" : "right";
    const dir = tok.slice("GP_LS_".length).toLowerCase() as "up" | "down" | "left" | "right";
    return encodeStickDirection(deviceID, stick, dir);
  }

  return encodeGamepadButton(deviceID, tok, binds);
}

function encodeDigital(d?: DigitalBinding, platform: Platform = "darwin", deviceID: string | null = null, binds?: GamepadBinds): string | null {
  if (!d) return null;
  if (d.type === "key") {
    return encodeKeyboard(d.code, platform);
  }
  if (d.type === "gp_button" || d.type === "gp_axis_digital") {
    return encodeGamepad(d, deviceID, binds);
  }
  return null;
}

export class AresTranslator implements IEmulatorTranslator {
  id = "ares";

  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[] {
    const platform = ctx.platform ?? "darwin";
    const patches: EmulatorPatch[] = [];
    const settingsPath = path.join(ctx.configDir, ARES.settingsFile);
    
    const players = [
      { key: "player1" as const, section: "VirtualPad1" },
      { key: "player2" as const, section: "VirtualPad2" },
      { key: "player3" as const, section: "VirtualPad3" },
      { key: "player4" as const, section: "VirtualPad4" },
    ];

    const deviceID = ctx.learnedDevice ? buildGamepadDeviceID(ctx.learnedDevice) : null;
    const binds = ctx.learnedBinds as GamepadBinds | undefined;
    // Which player slot the probed physical gamepad belongs to - not always
    // player1 (e.g. keyboard-P1/gamepad-P2 setups). ctx.player/padPort are
    // legacy single-player fields left at their defaults; this is the field
    // AresConfigurator actually resolves per-profile.
    const gamepadPlayerIndex = ctx.gamepadPlayerIndex ?? 0;
    log.info("Resolved gamepad device", {
      learnedDeviceGuid: ctx.learnedDevice,
      deviceID,
      gamepadPlayerIndex,
      bindsKeyCount: binds ? Object.keys(binds).length : 0,
    });

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const bindings = profile[p.key];
      if (!bindings) continue;

      const isGamepadPlayer = i === gamepadPlayerIndex;
      const updates = this.translateFromPlayer(bindings, platform, isGamepadPlayer ? deviceID : null, isGamepadPlayer ? binds : undefined);
      if (isGamepadPlayer) {
        const gamepadKeys = Object.entries(updates).filter(([, v]) => deviceID && v.startsWith(deviceID));
        log.info(`${p.key} ${p.section} patches`, {
          totalKeys: Object.keys(updates).length,
          gamepadKeys: gamepadKeys.map(([k]) => k),
        });
      }
      for (const [key, value] of Object.entries(updates)) {
        patches.push({
          kind: "ini-set",
          absPath: settingsPath,
          section: p.section,
          key,
          value,
        });
      }
    }
    return patches;
  }

  translateFromPlayer(p1: PlayerBindings, platform: Platform = "darwin", deviceID: string | null = null, binds?: GamepadBinds): Record<string, string> {
    const k = ARES.keys;
    const updates: Record<string, string> = {};
    if (!p1) return updates;

    const set = (key: string, d: DigitalBinding | undefined) => {
      const v = encodeDigital(d, platform, deviceID, binds);
      if (v) updates[key] = v;
    };

    set(k.lUp, getDirFromBinding(p1.move, "up"));
    set(k.lDown, getDirFromBinding(p1.move, "down"));
    set(k.lLeft, getDirFromBinding(p1.move, "left"));
    set(k.lRight, getDirFromBinding(p1.move, "right"));

    set(k.dpadUp, pickDir(p1.dpad, "up"));
    set(k.dpadDown, pickDir(p1.dpad, "down"));
    set(k.dpadLeft, pickDir(p1.dpad, "left"));
    set(k.dpadRight, pickDir(p1.dpad, "right"));

    set(k.a, p1.face?.primary);
    set(k.b, p1.face?.secondary);
    set(k.y, p1.face?.quaternary);

    set(k.start, p1.system?.start);
    set(k.select, p1.system?.select);

    set(k.l, p1.shoulders?.bumperL);
    set(k.r, p1.shoulders?.bumperR);

    const specialN64 = p1.special?.type === "n64" ? p1.special : undefined;
    set(k.z, specialN64?.z ?? p1.shoulders?.triggerL);

    const cDpad = specialN64?.c;
    set(k.rUp, getDirFromBinding(cDpad, "up") ?? getDirFromBinding(p1.look, "up"));
    set(k.rDown, getDirFromBinding(cDpad, "down") ?? getDirFromBinding(p1.look, "down"));
    set(k.rLeft, getDirFromBinding(cDpad, "left") ?? getDirFromBinding(p1.look, "left"));
    set(k.rRight, getDirFromBinding(cDpad, "right") ?? getDirFromBinding(p1.look, "right"));

    // Explicitly clear (Ares' own "unbound" convention) any pad key this
    // player doesn't have a binding for this round, rather than leaving it
    // unwritten. BmlEditor.updateBml only patches keys it's told about, so an
    // omitted key silently keeps whatever was on disk from a previous
    // run/player/bug (e.g. a stale gamepad binding left over from before a
    // player was reassigned to keyboard) and keeps firing forever.
    for (const key of ARES.allPadKeys) {
      if (!(key in updates)) updates[key] = ";;";
    }

    return updates;
  }
}