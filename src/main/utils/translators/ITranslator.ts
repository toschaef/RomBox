import type { Platform } from "../../../shared/types";
import type { ControlsProfile } from "../../../shared/types/controls";
import { ConsoleID } from "../../../shared/types";

export type EmulatorPatch =
  | { kind: "file-write"; absPath?: string; contents: string }
  | { kind: "ini-set"; absPath?: string; section: string; key: string; value: string }
  | { kind: "ini-delete"; absPath?: string; section: string; key: string }
  | { kind: "json-merge"; absPath?: string; path: string[]; value: unknown }
  | { kind: "json-set"; absPath?: string; path: string[]; value: unknown };

export interface TranslateContext {
  platform: Platform;
  consoleId?: ConsoleID;
  gameId?: string;
  player?: number;
  padPort?: number;
  configDir?: string;
  learnedDevice?: string;
  learnedBinds?: any;
  deviceIndex?: number;
  // 0-based index into [player1..player4] of the player slot the probed
  // physical gamepad (learnedDevice/learnedBinds) should be applied to. -1 or
  // undefined means no player is bound to a gamepad.
  gamepadPlayerIndex?: number;
  controllerId?: string;
  player2ControllerId?: string;
  player3ControllerId?: string;
  player4ControllerId?: string;
}

export interface IEmulatorTranslator {
  id: string;
  platform?: Platform;
  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[];
}