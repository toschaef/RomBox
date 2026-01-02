import type { Platform } from "../../../shared/types";
import type { ControlsProfile } from "../../../shared/controls/types";

export type EmulatorPatch =
  | { kind: "json-merge"; path: string[]; value: unknown }
  | { kind: "json-set"; path: string[]; value: unknown }
  | { kind: "ini-set"; section: string; key: string; value: string }
  | { kind: "ini-delete"; section: string; key: string };

export interface TranslateContext {
  platform: Platform;
  player?: number;
  padPort?: number;
}

export interface IEmulatorTranslator {
  id: string;
  platform?: Platform;
  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[];
}