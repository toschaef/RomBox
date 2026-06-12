import path from "path";
import { BaseConfigurator } from "./BaseConfigurator";
import { ControlsService } from "../../services/ControlsService";
import { osHandler } from "../../platform";
import { MesenTranslator } from "../translators/MesenTranslator";
import { getMesenBucket, getMesenControllerType } from "../schema/mesen";
import type { ConsoleID } from "../../../shared/types";

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

    const effectiveProfile = {
      ...profile,
      player1: p1,
    };

    const ctx = {
      platform: osHandler.getPlatform(),
      consoleId: this.consoleId,
      player: 1,
      padPort: 1,
      configDir: configPath,
    };

    const patches = this.translator.translate(effectiveProfile, ctx);

    for (const patch of patches) {
      if (patch.kind === "json-merge") {
        osHandler.updateJson<Record<string, unknown>>(
          settingsFile,
          (settings) => {
            const root = settings && typeof settings === "object" ? settings : {};
            const pathParts = patch.path;
            let current = root as Record<string, unknown>;
            for (let i = 0; i < pathParts.length - 1; i++) {
              const part = pathParts[i];
              if (!current[part] || typeof current[part] !== "object") {
                current[part] = {};
              }
              current = current[part] as Record<string, unknown>;
            }
            const lastPart = pathParts[pathParts.length - 1];
            current[lastPart] = patch.value;
            return root;
          },
          {}
        );
      }
    }
  }
}