import path from "path";
import { BaseConfigurator } from "./BaseConfigurator";
import { ControlsService } from "../../services/ControlsService";
import { osHandler } from "../../platform";
import type { ActionBindings } from "../../../shared/types/controls";
import { MesenTranslator } from "../translators/MesenTranslator";
import type { ConsoleID } from "../../../shared/types";
import { getMesenBucket } from "../schema/mesen";

type JsonObject = Record<string, unknown>;
type MesenMapping = Record<string, number>;
type MappingSlot = "Mapping1" | "Mapping2";

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

/** returns settings[bucket].Port{port}.Mapping{slot} as a mapping object if exists */
function ensureMappingNode(
  settings: JsonObject,
  bucket: string,
  port = 1,
  slot: MappingSlot = "Mapping1"
): MesenMapping {
  const sys = ensureObject(settings, bucket);
  const portNode = ensureObject(sys, `Port${port}`);
  const slotNode = ensureObject(portNode, slot);

  return slotNode as unknown as MesenMapping;
}

export class MesenConfigurator extends BaseConfigurator {
  private translator = new MesenTranslator();

  constructor(private consoleId: ConsoleID) {
    super();
  }

  async configure(): Promise<void> {
    const bucket = getMesenBucket(this.consoleId);
    if (!bucket) {
      console.warn(`[MesenConfigurator] Console ${this.consoleId} not handled by Mesen; skipping`);
      return;
    }

    const configPath = osHandler.getEmulatorConfigPath("mesen");
    const settingsFile = path.join(configPath, "settings.json");

    const svc = new ControlsService();
    let bindings: ActionBindings;

    try {
      bindings = svc.getDefaultProfile().bindings;
    } catch {
      console.warn("[MesenConfigurator] No default profile found; skipping.");
      return;
    }

    const mapping = this.translator.translate(bindings, 1);
    const keys = Object.keys(mapping);

    console.log(`[MesenConfigurator] Bucket=${bucket} Port1 Mapping1 keys=${keys.length}`);
    if (keys.length === 0) {
      console.warn("[MesenConfigurator] Mapping empty; not writing.");
      return;
    }

    osHandler.updateJson<unknown>(
      settingsFile,
      (settingsUnknown) => {
        const settings: JsonObject = isObject(settingsUnknown) ? settingsUnknown : {};

        const node = ensureMappingNode(settings, bucket, 1, "Mapping1");

        const beforeStart = typeof node.Start === "number" ? node.Start : undefined;
        Object.assign(node, mapping);
        const afterStart = typeof node.Start === "number" ? node.Start : undefined;

        console.log(
          `[MesenConfigurator] Patched ${bucket}.Port1.Mapping1 Start:`,
          beforeStart,
          "->",
          afterStart
        );

        return settings;
      },
      {}
    );
  }
}
