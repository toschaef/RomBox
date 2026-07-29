import fs from "fs";
import path from "path";
import { BaseConfigurator } from "./BaseConfigurator";
import { osHandler } from "../../platform";
import { ControlsService } from "../../services/ControlsService";
import { BmlEditor } from "../editors/bml";
import { ARES } from "../schema/ares";
import { AresTranslator } from "../translators/AresTranslator";
import { EngineService, getSdlProbePath, installSdlProbe } from "../../services/EngineService";
import { runSdlProbe } from "../azahar/sdlprobe";
import { Logger } from "../logger";

const log = Logger.create("AresConfigurator");

function exists(p: string) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!exists(dir)) fs.mkdirSync(dir, { recursive: true });
}

function pickSettingsPath(enginePath: string | null) {
  const appSupportDir = osHandler.getEmulatorConfigPath("ares");
  const appSupportBml = path.join(appSupportDir, ARES.settingsFile);

  const candidates: { label: string; file: string }[] = [{ label: "appSupport", file: appSupportBml }];

  if (enginePath) {
    const binDir = path.dirname(enginePath);
    let engineRoot = binDir;

    if (enginePath.includes(".app")) {
      const macosDir = binDir;
      const contentsDir = path.dirname(macosDir);
      const appDir = path.dirname(contentsDir);
      engineRoot = path.dirname(appDir);
    } else if (path.basename(binDir).startsWith("ares-v") || path.basename(binDir) !== "ares") {
      engineRoot = path.dirname(binDir);
    }

    candidates.push(
      { label: "portable_engineRoot", file: path.join(engineRoot, ARES.settingsFile) },
      { label: "portable_binDir", file: path.join(binDir, ARES.settingsFile) }
    );
  }

  const seen = new Set<string>();
  const uniq = candidates.filter((c) => {
    const k = path.resolve(c.file);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const existing = uniq.filter((c) => exists(c.file));
  return { candidates: uniq, existing };
}

export class AresConfigurator extends BaseConfigurator {
  private translator = new AresTranslator();

  async configure(): Promise<void> {
    const enginePath = await EngineService.getEnginePath('ares');

    const { candidates, existing } = pickSettingsPath(enginePath ?? null);

    let bmlPath: string;
    if (existing.length) {
      const nonSupport = existing.find((e) => e.label !== "appSupport") ?? existing[0];
      bmlPath = nonSupport.file;
    } else {
      const portableEngineRoot = candidates.find((c) => c.label === "portable_engineRoot");
      bmlPath = (portableEngineRoot ?? candidates[0]).file;
      ensureDirForFile(bmlPath);
      fs.writeFileSync(bmlPath, "");
    }

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const consoleId = "n64" as const;
    const layout = await svc.getEffectiveConsoleLayout(consoleId, profile.id);
    const effectiveProfile = {
      ...profile,
      player1: layout.player1,
      player2: layout.player2,
      player3: layout.player3,
      player4: layout.player4,
    };

    const probeHelperPath = getSdlProbePath();
    if (!exists(probeHelperPath)) {
      const installed = installSdlProbe();
      log.info("SDL probe install-on-demand", { probeHelperPath, installed });
    }

    let learnedDevice: string | undefined;
    let learnedBinds: unknown;
    if (exists(probeHelperPath)) {
      const probed = runSdlProbe({ helperPath: probeHelperPath, timeoutMs: 1500 });
      log.info("SDL probe result", {
        exitCode: probed.exitCode,
        rawStderr: probed.rawStderr,
        rawStdout: probed.rawStdout,
        guid: probed.learned?.guid,
        hasBinds: !!probed.learned?.binds,
      });
      if (probed.learned?.guid) learnedDevice = probed.learned.guid;
      if (probed.learned?.binds) learnedBinds = probed.learned.binds;
    } else {
      log.warn("SDL probe helper still missing after install attempt", { probeHelperPath });
    }

    const ctx = {
      platform: osHandler.getPlatform(),
      consoleId,
      player: 1,
      padPort: 1,
      configDir: path.dirname(bmlPath),
      controllerId: layout.controllerId,
      learnedDevice,
      learnedBinds,
    };

    const patches = this.translator.translate(effectiveProfile, ctx);

    const updatesBySection = new Map<string, Record<string, string>>();
    for (const patch of patches) {
      if (patch.kind !== "ini-set") continue;
      const updates = updatesBySection.get(patch.section) ?? {};
      updates[patch.key] = patch.value;
      updatesBySection.set(patch.section, updates);
    }

    for (const [section, updates] of updatesBySection) {
      BmlEditor.updateBml(bmlPath, [section], updates);
    }
  }
}