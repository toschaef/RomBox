import type { Platform } from "../../shared/types";
import type { ControlsProfile } from "../../shared/types/controls";
import { ConsoleID } from "../../shared/types";

export type EmulatorPatch =
  | { kind: "file-write"; absPath?: string; contents: string }
  | { kind: "ini-set"; absPath?: string; section: string; key: string; value: string }
  // Writes the key once per value. Emulators that read a setting as a list
  // (e.g. PCSX2 bindings) use repeated keys to bind several inputs to one action.
  | { kind: "ini-set-list"; absPath?: string; section: string; key: string; values: string[] }
  | { kind: "ini-delete"; absPath?: string; section: string; key: string }
  | { kind: "json-merge"; absPath?: string; path: string[]; value: unknown }
  | { kind: "json-set"; absPath?: string; path: string[]; value: unknown };

/** What a probed physical gamepad reported for a single control. */
export type LearnedBind =
  | { kind: "button"; button: number }
  | { kind: "axis"; axis: number; direction: "+" | "-"; threshold: number }
  | { kind: "hat"; hat: number; direction: "up" | "down" | "left" | "right" };

export type LearnedBinds = Record<string, LearnedBind>;

export interface TranslateContext {
  // required, with no default
  platform: Platform;
  // the directory the emulator's config files live in
  configDir: string;

  consoleId?: ConsoleID;
  gameId?: string;
  player?: number;
  padPort?: number;
  learnedDevice?: string;
  learnedBinds?: LearnedBinds;
  deviceIndex?: number;
  // 0-based index into [player1..player4] of the player slot the probed
  // physical gamepad (learnedDevice/learnedBinds) should be applied to. -1 or
  // undefined means no player is bound to a gamepad.
  gamepadPlayerIndex?: number;
  /** controller model per player slot, 0-based */
  controllerIds?: Array<string | undefined>;
}

export interface IEmulatorTranslator {
  id: string;
  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[];
}