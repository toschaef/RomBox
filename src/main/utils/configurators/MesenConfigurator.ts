import path from "path";
import { BaseConfigurator } from "./BaseConfigurator";
import { ControlsService } from "../../services/ControlsService";
import { osHandler } from "../../platform";
import { MesenTranslator } from "../translators/MesenTranslator";
import { getMesenBucket, getMesenControllerType } from "../schema/mesen";
import type { ConsoleID } from "../../../shared/types";

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

function ensureMappingNode(root: JsonObject, slot: MappingSlot): JsonObject {
  return ensureObject(root, slot);
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

export class MesenConfigurator extends BaseConfigurator {
  private translator = new MesenTranslator();

  constructor(private consoleId: ConsoleID) {
    super();
  }

  async configure(): Promise<void> {
    const bucket = getMesenBucket(this.consoleId);
    const type = getMesenControllerType(this.consoleId);

    if (!bucket || !type) {
      console.error(`[MesenConfigurator] ABORTING: Bucket or Type missing for ${this.consoleId}`);
      return;
    }

    const configPath = osHandler.getEmulatorConfigPath("mesen");
    const settingsFile = path.join(configPath, "settings.json");

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const p1 = await svc.getEffectiveConsoleBindings(this.consoleId, profile.id);

    const slotPlan: Record<MappingSlot, { device: "keyboard" | "gamepad"; dirSource: "move" | "dpad" }> = {
      Mapping1: { device: "keyboard", dirSource: "move" },
      Mapping2: { device: "keyboard", dirSource: "dpad" },
      Mapping3: { device: "gamepad", dirSource: "move" },
      Mapping4: { device: "gamepad", dirSource: "dpad" },
    };

    const slotMaps = {
      Mapping1: this.translator.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping1.device, slotPlan.Mapping1.dirSource, this.consoleId),
      Mapping2: this.translator.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping2.device, slotPlan.Mapping2.dirSource, this.consoleId),
      Mapping3: this.translator.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping3.device, slotPlan.Mapping3.dirSource, this.consoleId),
      Mapping4: this.translator.translateForDeviceFromPlayer(p1, 1, slotPlan.Mapping4.device, slotPlan.Mapping4.dirSource, this.consoleId),
    } satisfies Record<MappingSlot, Record<string, number>>;

    osHandler.updateJson<unknown>(
      settingsFile,
      (settingsUnknown) => {
        const settings: JsonObject = isObject(settingsUnknown) ? settingsUnknown : {};
        
        const bucketNode = ensureObject(settings, bucket);

        const { keys: rootKeysToWrite } = collectRootKeysToWrite(bucketNode, this.consoleId);

        for (const rootKey of rootKeysToWrite) {
          const rootNode = ensureObject(bucketNode, rootKey);

          if (rootNode["Type"] !== type) {
            rootNode["Type"] = type;
          }

          for (const slot of ALL_SLOTS) {
            const mapForSlot = slotMaps[slot];

            if (Object.keys(mapForSlot).length === 0) {
                continue;
            }
            const node = ensureMappingNode(rootNode, slot);
            Object.assign(node, mapForSlot);
          }
        }

        return settings;
    }, {});
  }
}