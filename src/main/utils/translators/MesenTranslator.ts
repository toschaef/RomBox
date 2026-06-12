import type { PlayerBindings, DigitalBinding, ControlsProfile } from "../../../shared/types/controls";
import type { IEmulatorTranslator, EmulatorPatch, TranslateContext } from "./ITranslator";
import { GP_FIXED_TO_INDEX, type GamepadToken } from "../../../shared/controls/gamepadTokens";
import { BASE_GAMEPAD, MESEN_KEYCODE_MAP_128, APPLE_KEYCODE_BY_CODE, getMesenBucket, getMesenControllerType } from "../schema/mesen";
import { digitalToGamepadToken, pickDir, getDirFromBinding, type Dir } from "../profileRead";
import type { ConsoleID } from "../../../shared/types";
import path from "path";
import fs from "fs";

type Device = "keyboard" | "gamepad";
type DirSource = "dpad" | "move";

function mesenKeyboardCode(domCode: string): number | null {
  const apple = APPLE_KEYCODE_BY_CODE[domCode];
  if (apple === undefined || apple < 0 || apple >= MESEN_KEYCODE_MAP_128.length) return null;

  const mapped = MESEN_KEYCODE_MAP_128[apple] ?? 0;
  return mapped === 0 ? null : mapped;
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

function translateDigital(d: DigitalBinding | undefined, player: number, device: Device | null): number | null {
  if (!d) return null;

  if (d.type === "key") {
    if (device && device !== "keyboard") return null;
    return mesenKeyboardCode(d.code);
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

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function ensureObject(obj: JsonObject, key: string): JsonObject {
  const existing = obj[key];
  if (isObject(existing)) return existing;
  const created: JsonObject = {};
  obj[key] = created;
  return created;
}

function preferredRootKey(consoleId: ConsoleID): "Port1" | "Controller" {
  if (consoleId === "gb" || consoleId === "gba") return "Controller";
  return "Port1";
}

function isRootKeyCandidate(k: string) {
  return k === "Port1" || k.startsWith("Port1") || k === "Controller" || k.startsWith("Controller");
}

function collectRootKeysToWrite(bucketNode: JsonObject, consoleId: ConsoleID): { keys: string[]; preferred: string } {
  const preferred = preferredRootKey(consoleId);

  const existing = Object.keys(bucketNode)
    .filter((k) => isRootKeyCandidate(k))
    .filter((k) => isObject(bucketNode[k]));

  const all = new Set<string>([...existing, preferred]);
  return { keys: [...all], preferred };
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

    const slotMaps = {
      Mapping1: this.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping1.device, slotPlan.Mapping1.dirSource),
      Mapping2: this.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping2.device, slotPlan.Mapping2.dirSource),
      Mapping3: this.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping3.device, slotPlan.Mapping3.dirSource),
      Mapping4: this.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping4.device, slotPlan.Mapping4.dirSource),
    };

    const configPath = ctx.configDir || "";
    const settingsFile = path.join(configPath, "settings.json");

    let settings: JsonObject = {};
    try {
      if (fs.existsSync(settingsFile)) {
        settings = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
      }
    } catch {
      // Ignored
    }

    const bucketNode = ensureObject(settings, bucket);
    const { keys: rootKeysToWrite } = collectRootKeysToWrite(bucketNode, consoleId);

    const bucketUpdates = structuredClone(bucketNode);

    for (const rootKey of rootKeysToWrite) {
      const rootNode = ensureObject(bucketUpdates, rootKey);

      if (rootNode["Type"] !== type) {
        rootNode["Type"] = type;
      }

      for (const slot of ALL_SLOTS) {
        const mapForSlot = slotMaps[slot];

        if (Object.keys(mapForSlot).length === 0) {
            continue;
        }
        const node = ensureObject(rootNode, slot);
        Object.assign(node, mapForSlot);
      }
    }

    return [
      {
        kind: "json-merge",
        path: [bucket],
        value: bucketUpdates,
      }
    ];
  }

  translateForDeviceFromPlayer(
    p1: PlayerBindings,
    player = 1,
    device: Device | null,
    dirSource: DirSource,
  ): Record<string, number> {
    const mapping: Record<string, number> = {};

    const setDir = (mesenKey: "Up" | "Down" | "Left" | "Right", dir: Dir) => {
      const binding = dirSource === "dpad" ? pickDir(p1.dpad, dir) : getDirFromBinding(p1.move, dir);
      const v = translateDigital(binding, player, device);
      if (v !== null) mapping[mesenKey] = v;
    };

    setDir("Up", "up");
    setDir("Down", "down");
    setDir("Left", "left");
    setDir("Right", "right");

    const set = (mesenKey: string, d?: DigitalBinding) => {
      const v = translateDigital(d, player, device);
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