import path from "path";
import type { PlayerBindings, DigitalBinding, ControlsProfile } from "../../../shared/types/controls";
import type { IEmulatorTranslator, EmulatorPatch, TranslateContext } from "./ITranslator";
import { GP_FIXED_TO_INDEX, type GamepadToken } from "../../../shared/controls/gamepadTokens";
import { BASE_GAMEPAD, getMesenBucket, getMesenControllerType } from "../schema/mesen";
import { digitalToGamepadToken, pickDir, getDirFromBinding, type Dir } from "../profileRead";
import type { ConsoleID, Platform } from "../../../shared/types";
import { KeycodeMapper } from "../keycodes/KeycodeMapper";

type Device = "keyboard" | "gamepad";
type DirSource = "dpad" | "move";

function mesenKeyboardCode(domCode: string, platform: Platform = "darwin"): number | null {
  const code = KeycodeMapper.toKeycode("mesen", domCode, platform);
  return typeof code === "number" ? code : null;
}

function mesenGamepadCode(token: GamepadToken, port1Based: number): number {
  const idx = GP_FIXED_TO_INDEX[token];
  if (idx === undefined) {
      console.warn(`[mesen-debug] Unknown Gamepad Token: ${token}`);
      return 0;
  }
  const p = Math.max(1, port1Based) - 1;
  return BASE_GAMEPAD + p * 0x100 + idx;
}

function fixToken(tok: GamepadToken): GamepadToken {
  return tok;
}

function translateDigital(d: DigitalBinding | undefined, player: number, device: Device | null, platform: Platform = "darwin"): number | null {
  if (!d) return null;

  if (d.type === "key") {
    if (device && device !== "keyboard") return null;
    return mesenKeyboardCode(d.code, platform);
  }

  const gpTok = digitalToGamepadToken(d);
  if (!gpTok) {
      return null;
  }
  
  if (device && device !== "gamepad") return null;

  return mesenGamepadCode(fixToken(gpTok), player);
}

type JsonObject = Record<string, unknown>;
type MappingSlot = "Mapping1" | "Mapping2" | "Mapping3" | "Mapping4";
const ALL_SLOTS: readonly MappingSlot[] = ["Mapping1", "Mapping2", "Mapping3", "Mapping4"] as const;

function preferredRootKey(consoleId: ConsoleID): "Port1" | "Controller" {
  if (consoleId === "gb" || consoleId === "gba") return "Controller";
  return "Port1";
}

export class MesenTranslator implements IEmulatorTranslator {
  id = "mesen";

  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[] {
    const consoleId = ctx.consoleId;
    if (!consoleId) throw new Error("MesenTranslator requires ctx.consoleId");

    const bucket = getMesenBucket(consoleId);
    const type = getMesenControllerType(consoleId);
    if (!bucket || !type) return [];

    const p1 = profile.player1;
    const slotPlan: Record<MappingSlot, { device: "keyboard" | "gamepad"; dirSource: "move" | "dpad" }> = {
      Mapping1: { device: "keyboard", dirSource: "move" },
      Mapping2: { device: "keyboard", dirSource: "dpad" },
      Mapping3: { device: "gamepad", dirSource: "move" },
      Mapping4: { device: "gamepad", dirSource: "dpad" },
    };

    const platform = ctx.platform ?? "darwin";
    const slotMaps = {
      Mapping1: this.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping1.device, slotPlan.Mapping1.dirSource, platform),
      Mapping2: this.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping2.device, slotPlan.Mapping2.dirSource, platform),
      Mapping3: this.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping3.device, slotPlan.Mapping3.dirSource, platform),
      Mapping4: this.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping4.device, slotPlan.Mapping4.dirSource, platform),
    };

    const rootKey = preferredRootKey(consoleId);
    const rootNode: JsonObject = { Type: type };

    for (const slot of ALL_SLOTS) {
      const mapForSlot = slotMaps[slot];
      if (Object.keys(mapForSlot).length > 0) {
        rootNode[slot] = mapForSlot;
      }
    }

    const bucketUpdates: JsonObject = {
      [rootKey]: rootNode,
    };

    const absPath = ctx.configDir ? path.join(ctx.configDir, "settings.json") : undefined;

    return [
      {
        kind: "json-merge",
        absPath,
        path: [bucket],
        value: bucketUpdates,
      }
    ];
  }

  translateForDeviceFromPlayer(
    p1: PlayerBindings,
    player = 1,
    device: Device | null = null,
    dirSource: DirSource = "move",
    platform: Platform = "darwin",
  ): Record<string, number> {
    const mapping: Record<string, number> = {};

    const setDir = (mesenKey: "Up" | "Down" | "Left" | "Right", dir: Dir) => {
      const binding = dirSource === "dpad" ? pickDir(p1.dpad, dir) : getDirFromBinding(p1.move, dir);
      const v = translateDigital(binding, player, device, platform);
      if (v !== null) mapping[mesenKey] = v;
    };

    setDir("Up", "up");
    setDir("Down", "down");
    setDir("Left", "left");
    setDir("Right", "right");

    const set = (mesenKey: string, d?: DigitalBinding) => {
      const v = translateDigital(d, player, device, platform);
      if (v !== null) mapping[mesenKey] = v;
    };
    
    set("A", p1.face.primary);
    set("B", p1.face.secondary);
    set("X", p1.face.tertiary);
    set("Y", p1.face.quaternary);

    set("L", p1.shoulders.bumperL);
    set("R", p1.shoulders.bumperR);
    set("L2", p1.shoulders.triggerL);
    set("R2", p1.shoulders.triggerR);

    set("Start", p1.system.start);
    set("Select", p1.system.select);

    return mapping;
  }
}