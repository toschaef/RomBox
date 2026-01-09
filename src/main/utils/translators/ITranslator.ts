import type { Platform } from "../../../shared/types";
import type { ControlsProfile } from "../../../shared/controls/types";
import { ConsoleID } from "../../../shared/types";

export type EmulatorPatch =
  | { kind: "file-write"; absPath?: string; contents: string }
  | { kind: "ini-set"; absPath?: string; section: string; key: string; value: string }
  | { kind: "ini-delete"; absPath?: string; section: string; key: string }
  | { kind: "json-merge"; path: string[]; value: unknown }
  | { kind: "json-set"; path: string[]; value: unknown };

export interface TranslateContext {
  platform: Platform;
  consoleId?: ConsoleID;
  gameId?: string;
  player?: number;
  padPort?: number;
  configDir?: string;
}

export interface IEmulatorTranslator {
  id: string;
  platform?: Platform;
  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[];
}