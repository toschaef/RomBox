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

/* XInput button order from WindowsKeyManager.cpp (indices are j+1):
 * "Up"(1), "Down"(2), "Left"(3), "Right"(4), "Start"(5), "Back"(6),
 * "L3"(7), "R3"(8), "L1"(9), "R1"(10), "?"(11), "?"(12),
 * "A"(13), "B"(14), "X"(15), "Y"(16), "L2"(17), "R2"(18)  */
const MESEN_WIN32_GAMEPAD_MAP: Partial<Record<GamepadToken, number>> = {
  GP_DPAD_UP: 1, GP_DPAD_DOWN: 2, GP_DPAD_LEFT: 3, GP_DPAD_RIGHT: 4,
  GP_START: 5, GP_SELECT: 6, GP_L3: 7, GP_R3: 8,
  GP_L1: 9, GP_R1: 10,
  GP_A: 13, GP_B: 14, GP_X: 15, GP_Y: 16,
  GP_L2: 17, GP_R2: 18,
};

/* GCController button order from MacOSKeyManager.mm:
 * "A"(0), "B"(1), "X"(2), "Y"(3), "L1"(4), "R1"(5), "Start"(6), "Select"(7),
 * "Up"(8), "Down"(9), "Left"(10), "Right"(11), "L2"(12), "R2"(13), "L3"(14), "R3"(15),
 * "X+"(16), "X-"(17), "Y+"(18), "Y-"(19), "X2+"(20), "X2-"(21), "Y2+"(22), "Y2-"(23) */
const MESEN_MACOS_GAMEPAD_MAP: Partial<Record<GamepadToken, number>> = {
  GP_A: 0, GP_B: 1, GP_X: 2, GP_Y: 3,
  GP_L1: 4, GP_R1: 5, GP_START: 6, GP_SELECT: 7,
  GP_DPAD_UP: 8, GP_DPAD_DOWN: 9, GP_DPAD_LEFT: 10, GP_DPAD_RIGHT: 11,
  GP_L2: 12, GP_R2: 13, GP_L3: 14, GP_R3: 15,
  GP_LS_RIGHT: 16, GP_LS_LEFT: 17, GP_LS_UP: 18, GP_LS_DOWN: 19,
  GP_RS_RIGHT: 20, GP_RS_LEFT: 21, GP_RS_UP: 22, GP_RS_DOWN: 23,
};

/* SDL/evdev button order from LinuxKeyManager.cpp:
 * "A"(0), "B"(1), "C"(2), "X"(3), "Y"(4), "Z"(5), "L1"(6), "R1"(7),
 * "L2"(8), "R2"(9), "Select"(10), "Start"(11), "L3"(12), "R3"(13),
 * Axes: "X+"(14).."Y-"(19), "X2+"(20).."Y2-"(23), ...
 * DPad: "Right"(26), "Left"(27), "Down"(28), "Up"(29) */
const MESEN_LINUX_GAMEPAD_MAP: Partial<Record<GamepadToken, number>> = {
  GP_A: 0, GP_B: 1, GP_X: 3, GP_Y: 4,
  GP_L1: 6, GP_R1: 7, GP_L2: 8, GP_R2: 9,
  GP_SELECT: 10, GP_START: 11, GP_L3: 12, GP_R3: 13,
  GP_LS_RIGHT: 14, GP_LS_LEFT: 15, GP_LS_DOWN: 16, GP_LS_UP: 17,
  GP_RS_RIGHT: 18, GP_RS_LEFT: 19,
  GP_DPAD_RIGHT: 26, GP_DPAD_LEFT: 27, GP_DPAD_DOWN: 28, GP_DPAD_UP: 29,
};

function mesenGamepadCode(token: GamepadToken, port1Based: number, platform: Platform): number {
  const map = platform === "win32" ? MESEN_WIN32_GAMEPAD_MAP
            : platform === "darwin" ? MESEN_MACOS_GAMEPAD_MAP
            : MESEN_LINUX_GAMEPAD_MAP;
  const idx = map[token];
  if (idx === undefined) {
      console.warn(`[mesen-debug] Unknown Gamepad Token on ${platform}: ${token}`);
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

  return mesenGamepadCode(fixToken(gpTok), player, platform);
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
    const layout = profile as unknown as { player1: PlayerBindings; player2?: PlayerBindings; player3?: PlayerBindings; player4?: PlayerBindings };
    if (!consoleId) throw new Error("MesenTranslator requires ctx.consoleId");

    const bucket = getMesenBucket(consoleId);
    const type = getMesenControllerType(consoleId, ctx.controllerId);
    if (!bucket || !type) return [];

    const platform = ctx.platform ?? "darwin";
    const bucketUpdates: JsonObject = {};

    const slotPlan: Record<MappingSlot, { device: "keyboard" | "gamepad"; dirSource: "move" | "dpad" }> = {
      Mapping1: { device: "keyboard", dirSource: "move" },
      Mapping2: { device: "keyboard", dirSource: "dpad" },
      Mapping3: { device: "gamepad", dirSource: "move" },
      Mapping4: { device: "gamepad", dirSource: "dpad" },
    };

    const players = [
      { key: "Port1", player: layout.player1 },
      { key: "Port2", player: layout.player2 },
      { key: "Port3", player: layout.player3 },
      { key: "Port4", player: layout.player4 },
    ];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.player) continue;

      const pNum = i + 1;
      const rootKey = preferredRootKey(consoleId) === "Controller" && pNum === 1 ? "Controller" : p.key;

      if (preferredRootKey(consoleId) === "Controller" && pNum > 1) continue;

      const slotMaps = {
        Mapping1: this.translateForDeviceFromPlayer(p.player, pNum, slotPlan.Mapping1.device, slotPlan.Mapping1.dirSource, platform),
        Mapping2: this.translateForDeviceFromPlayer(p.player, pNum, slotPlan.Mapping2.device, slotPlan.Mapping2.dirSource, platform),
        Mapping3: this.translateForDeviceFromPlayer(p.player, pNum, slotPlan.Mapping3.device, slotPlan.Mapping3.dirSource, platform),
        Mapping4: this.translateForDeviceFromPlayer(p.player, pNum, slotPlan.Mapping4.device, slotPlan.Mapping4.dirSource, platform),
      };

      const rootNode: JsonObject = { Type: type };
      let hasBinds = false;
      for (const slot of ALL_SLOTS) {
        const mapForSlot = slotMaps[slot];
        if (Object.keys(mapForSlot).length > 0) {
          rootNode[slot] = mapForSlot;
          hasBinds = true;
        }
      }

      if (hasBinds || pNum === 1) {
        if (consoleId === "pce") {
          const pceKeys = ["Port1A", "Port1B", "Port1C", "Port1D"];
          bucketUpdates[pceKeys[i]] = rootNode;
        } else if (consoleId === "snes") {
          if (pNum === 1) bucketUpdates["Port1"] = rootNode;
          else {
            const snesMultiKeys = ["", "Port2A", "Port2B", "Port2C", "Port2D"];
            bucketUpdates[snesMultiKeys[pNum - 1]] = rootNode;
          }
        } else if (consoleId === "nes") {
          const nesKeys = ["Port1A", "Port1B", "Port1C", "Port1D"];
          bucketUpdates[nesKeys[i]] = rootNode;
        } else {
          bucketUpdates[rootKey] = rootNode;
        }
      }
    }

    if (consoleId === "pce") {
      const needsTurboTap = !!bucketUpdates["Port1B"] || !!bucketUpdates["Port1C"] || !!bucketUpdates["Port1D"];
      if (needsTurboTap) {
        if (bucketUpdates["Port1A"]) {
          bucketUpdates["Port1"] = { ...(bucketUpdates["Port1A"] as JsonObject), Type: "PceTurboTap" };
          bucketUpdates["Port1A"] = { Type: (bucketUpdates["Port1A"] as JsonObject).Type };
        }
      } else {
        if (bucketUpdates["Port1A"]) {
          bucketUpdates["Port1"] = bucketUpdates["Port1A"];
          delete bucketUpdates["Port1A"];
        }
      }
    } else if (consoleId === "snes") {
      const needsMultitap = !!bucketUpdates["Port2B"] || !!bucketUpdates["Port2C"] || !!bucketUpdates["Port2D"];
      if (needsMultitap) {
        if (bucketUpdates["Port2A"]) {
          bucketUpdates["Port2"] = { ...(bucketUpdates["Port2A"] as JsonObject), Type: "Multitap" };
          bucketUpdates["Port2A"] = { Type: (bucketUpdates["Port2A"] as JsonObject).Type };
        }
      } else {
        if (bucketUpdates["Port2A"]) {
          bucketUpdates["Port2"] = bucketUpdates["Port2A"];
          delete bucketUpdates["Port2A"];
        }
      }
    } else if (consoleId === "nes") {
      const needsFourScore = !!bucketUpdates["Port1C"] || !!bucketUpdates["Port1D"];
      if (needsFourScore) {
        if (bucketUpdates["Port1A"]) {
          bucketUpdates["Port1"] = { ...(bucketUpdates["Port1A"] as JsonObject), Type: "FourScore" };
          bucketUpdates["Port1A"] = { Type: (bucketUpdates["Port1A"] as JsonObject).Type };
        }
        if (bucketUpdates["Port1B"]) {
          bucketUpdates["Port2"] = { ...(bucketUpdates["Port1B"] as JsonObject), Type: "FourScore" };
          bucketUpdates["Port1B"] = { Type: (bucketUpdates["Port1B"] as JsonObject).Type };
        }
      } else {
        if (bucketUpdates["Port1A"]) {
          bucketUpdates["Port1"] = bucketUpdates["Port1A"];
          delete bucketUpdates["Port1A"];
        }
        if (bucketUpdates["Port1B"]) {
          bucketUpdates["Port2"] = bucketUpdates["Port1B"];
          delete bucketUpdates["Port1B"];
        }
      }
    }

    const absPath = ctx.configDir ? path.join(ctx.configDir, "settings.json") : undefined;

    return [
      {
        kind: "json-set",
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

    set("L", p1.face.quinary ?? p1.shoulders.bumperL);
    set("R", p1.face.senary ?? p1.shoulders.bumperR);
    set("L2", p1.shoulders.triggerL);
    set("R2", p1.shoulders.triggerR);

    set("Start", p1.system.start);
    set("Select", p1.system.select);

    return mapping;
  }
}