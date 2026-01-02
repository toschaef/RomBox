import path from "path";
import { BaseConfigurator } from "./BaseConfigurator";
import { ControlsService } from "../../services/ControlsService";
import { osHandler } from "../../platform";
import { MesenTranslator } from "../translators/MesenTranslator";
import type { ConsoleID } from "../../../shared/types";

type JsonObject = Record<string, unknown>;
type MesenMapping = Record<string, number>;
type MappingSlot = "Mapping1" | "Mapping2" | "Mapping3" | "Mapping4";

type InputRoot =
  | { kind: "port"; port: number }
  | { kind: "key"; key: string };

type MesenSpec = {
  bucket: string;
  root: InputRoot;
  type: string;
};

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

function rootKey(root: InputRoot): string {
  return root.kind === "port" ? `Port${root.port}` : root.key;
}

function ensureRootNode(settings: JsonObject, spec: MesenSpec): JsonObject {
  const sys = ensureObject(settings, spec.bucket);
  return ensureObject(sys, rootKey(spec.root));
}

function ensureMappingNode(settings: JsonObject, spec: MesenSpec, slot: MappingSlot): MesenMapping {
  const root = ensureRootNode(settings, spec);
  const node = ensureObject(root, slot);
  return node as unknown as MesenMapping;
}

function ensureControllerType(settings: JsonObject, spec: MesenSpec): void {
  const root = ensureRootNode(settings, spec);
  const cur = root["Type"];
  if (cur === undefined || cur === "None") root["Type"] = spec.type;
}

const MESEN_SPEC: Partial<Record<ConsoleID, MesenSpec>> = {
  nes:  { bucket: "Nes",      root: { kind: "port", port: 1 }, type: "NesController" },
  snes: { bucket: "Snes",     root: { kind: "port", port: 1 }, type: "SnesController" },
  pce:  { bucket: "PcEngine", root: { kind: "port", port: 1 }, type: "PceController" },

  gb:   { bucket: "Gameboy",  root: { kind: "key", key: "Controller" }, type: "GameboyController" },
  gba:  { bucket: "Gba",      root: { kind: "key", key: "Controller" }, type: "GbaController" },

  sms:  { bucket: "Sms",      root: { kind: "port", port: 1 }, type: "SmsController" },
  gg:   { bucket: "Sms",      root: { kind: "port", port: 1 }, type: "SmsController" },
};

const ALL_SLOTS: readonly MappingSlot[] = ["Mapping1", "Mapping2", "Mapping3", "Mapping4"] as const;

export class MesenConfigurator extends BaseConfigurator {
  private translator = new MesenTranslator();

  constructor(private consoleId: ConsoleID) {
    super();
  }

  async configure(): Promise<void> {
    const spec = MESEN_SPEC[this.consoleId];
    if (!spec) return;

    const configPath = osHandler.getEmulatorConfigPath("mesen");
    const settingsFile = path.join(configPath, "settings.json");

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();

    const keyboardMap  = this.translator.translateForDevice(profile, 1, "keyboard", "dpad");
    const gamepadDpad  = this.translator.translateForDevice(profile, 1, "gamepad", "dpad");
    const gamepadMove  = this.translator.translateForDevice(profile, 1, "gamepad", "move");

    const slotMaps: Partial<Record<MappingSlot, Record<string, number>>> = {
      Mapping1: keyboardMap,
      Mapping2: gamepadDpad,
      Mapping3: gamepadMove,
    };

    osHandler.updateJson<unknown>(
      settingsFile,
      (settingsUnknown) => {
        const settings: JsonObject = isObject(settingsUnknown) ? settingsUnknown : {};

        ensureControllerType(settings, spec);

        const root = ensureRootNode(settings, spec);

        for (const slot of ALL_SLOTS) {
          const mapForSlot = slotMaps[slot];
          if (!mapForSlot || Object.keys(mapForSlot).length === 0) continue;

          const node = ensureMappingNode(settings, spec, slot);
          Object.assign(node, mapForSlot);
        }

        return settings;
      },
      {}
    );
  }
}