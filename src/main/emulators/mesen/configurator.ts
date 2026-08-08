import fs from "fs";
import path from "path";
import { BaseConfigurator } from "../BaseConfigurator";
import { osHandler } from "../../platform";
import { Logger } from "../../utils/logger";
import { MesenTranslator } from "./translator";
import { getMesenBucket, getMesenControllerType } from "./schema";
import type { ConsoleID } from "../../../shared/types";

const log = Logger.create("MesenConfigurator");

export class MesenConfigurator extends BaseConfigurator {
  private translator = new MesenTranslator();

  constructor(private consoleId: ConsoleID) {
    super();
  }

  async configure(): Promise<void> {
    const bucket = getMesenBucket(this.consoleId);
    const type = getMesenControllerType(this.consoleId);

    if (!bucket || !type) {
      log.error(`ABORTING: Bucket or Type missing for ${this.consoleId}`);
      return;
    }

    const configPath = osHandler.getEmulatorConfigPath("mesen");
    fs.mkdirSync(configPath, { recursive: true });
    const settingsFile = path.join(configPath, "settings.json");

    const { layout, effectiveProfile } = await this.resolveControls(this.consoleId);

    const ctx = {
      platform: osHandler.getPlatform(),
      consoleId: this.consoleId,
      player: 1,
      padPort: 1,
      configDir: configPath,
      controllerIds: layout.controllerIds,
    };

    const patches = this.translator.translate(effectiveProfile, ctx);

    for (const patch of patches) {
      if (!patch.absPath) {
        patch.absPath = settingsFile;
      }
    }

    this.applyPatches(patches);
  }
}