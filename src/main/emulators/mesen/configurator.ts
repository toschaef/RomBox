import fs from "fs";
import path from "path";
import { BaseConfigurator } from "../BaseConfigurator";
import { osHandler } from "../../platform";
import { Logger } from "../../utils/logger";
import { MesenTranslator } from "./translator";
import { getMesenBucket, getMesenControllerType } from "./schema";
import type { ConsoleID } from "../../../shared/types";
import type { LearnedBinds } from "../translatorTypes";
import type { PlayerBindings, DigitalBinding } from "../../../shared/types/controls";
import { getSdlProbePath, installSdlProbe } from "../../services/EngineService";
import { runSdlProbe } from "../azahar/sdlProbe";

const log = Logger.create("MesenConfigurator");

function looksLikeGamepadPlayer(p1: PlayerBindings): boolean {
  if (p1.move.type === "stick") return true;

  const all: (DigitalBinding | undefined)[] = [
    p1.face.primary, p1.face.secondary, p1.face.tertiary, p1.face.quaternary,
    p1.shoulders.bumperL, p1.shoulders.bumperR, p1.shoulders.triggerL, p1.shoulders.triggerR,
    p1.system.start, p1.system.select,
    p1.dpad.up, p1.dpad.down, p1.dpad.left, p1.dpad.right,
  ];

  return all.some((b) => b?.type === "gp_button" || b?.type === "gp_axis_digital");
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
      log.error(`ABORTING: Bucket or Type missing for ${this.consoleId}`);
      return;
    }

    const configPath = osHandler.getEmulatorConfigPath("mesen");
    fs.mkdirSync(configPath, { recursive: true });
    const settingsFile = path.join(configPath, "settings.json");

    const { layout, effectiveProfile } = await this.resolveControls(this.consoleId);
    const platform = osHandler.getPlatform();

    let learnedBinds: LearnedBinds | undefined;
    const players = [layout.player1, layout.player2, layout.player3, layout.player4].filter(
      (p): p is PlayerBindings => !!p
    );
    if (platform === "win32" && players.some(looksLikeGamepadPlayer)) {
      try {
        let probeHelperPath = getSdlProbePath();
        if (!fs.existsSync(probeHelperPath)) {
          const installed = installSdlProbe();
          if (installed.dest) probeHelperPath = installed.dest;
        }
        if (fs.existsSync(probeHelperPath)) {
          const probed = runSdlProbe({ helperPath: probeHelperPath, timeoutMs: 1500, forceDirectInputBackend: true });
          log.info("SDL probe result", {
            exitCode: probed.exitCode,
            guid: probed.learned?.guid,
            name: probed.learned?.name,
            boundTokens: probed.learned?.binds ? Object.keys(probed.learned.binds) : [],
            rawStdout: probed.rawStdout,
            rawStderr: probed.rawStderr,
          });
          if (probed.learned?.binds) learnedBinds = probed.learned.binds as LearnedBinds;
        } else {
          log.warn("SDL probe helper missing after install attempt", { probeHelperPath });
        }
      } catch (err) {
        log.warn("SDL probe failed; DirectInput fallback limited to fixed stick/dpad codes", err);
      }
    }

    const ctx = {
      platform,
      consoleId: this.consoleId,
      player: 1,
      padPort: 1,
      configDir: configPath,
      controllerIds: layout.controllerIds,
      deviceIndex: 0,
      learnedBinds,
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