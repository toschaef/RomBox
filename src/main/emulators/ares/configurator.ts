import fs from "fs";
import path from "path";
import { BaseConfigurator } from "../BaseConfigurator";
import type { LearnedBinds } from "../translatorTypes";
import { osHandler } from "../../platform";
import { BmlEditor } from "../../utils/editors/bml";
import { ARES } from "./schema";
import { AresTranslator } from "./translator";
import { EngineService, getSdlProbePath, installSdlProbe } from "../../services/EngineService";
import { runSdlProbe } from "../azahar/sdlProbe";
import { Logger } from "../../utils/logger";
import type { PlayerBindings, DigitalBinding } from "../../../shared/types/controls";

const log = Logger.create("AresConfigurator");

// The physical gamepad probed below can only ever be assigned to whichever
// player slot the user actually bound it to - it's not always player1 (e.g.
// keyboard-P1/gamepad-P2 setups). Detect that slot by inspecting which
// player's bindings actually use gp_button/gp_axis_digital tokens, mirroring
// DolphinTranslator's per-player detectDeviceKindFromProfile.
function looksLikeGamepadPlayer(p?: PlayerBindings): boolean {
  if (!p) return false;
  const all: (DigitalBinding | undefined)[] = [
    p.face?.primary, p.face?.secondary, p.face?.tertiary, p.face?.quaternary,
    p.shoulders?.bumperL, p.shoulders?.bumperR, p.shoulders?.triggerL, p.shoulders?.triggerR,
    p.system?.start, p.system?.select,
    p.dpad?.up, p.dpad?.down, p.dpad?.left, p.dpad?.right,
  ];

  if (p.move?.type === "dpad") all.push(p.move.up, p.move.down, p.move.left, p.move.right);
  if (p.look?.type === "dpad") all.push(p.look.up, p.look.down, p.look.left, p.look.right);

  const special = p.special;
  if (special?.type === "n64" || special?.type === "gc") all.push(special.z);

  return all.some((b) => b?.type === "gp_button" || b?.type === "gp_axis_digital");
}

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

    const consoleId = "n64" as const;
    const { layout, effectiveProfile } = await this.resolveControls(consoleId);

    const players: (PlayerBindings | undefined)[] = [
      effectiveProfile.player1, effectiveProfile.player2, effectiveProfile.player3, effectiveProfile.player4,
    ];
    const gamepadPlayerIndex = players.findIndex((p) => looksLikeGamepadPlayer(p));
    log.info("Resolved gamepad player slot", { gamepadPlayerIndex });

    const probeHelperPath = getSdlProbePath();
    if (!exists(probeHelperPath)) {
      const installed = installSdlProbe();
      log.info("SDL probe install-on-demand", { probeHelperPath, installed });
    }

    let learnedDevice: string | undefined;
    let learnedBinds: LearnedBinds | undefined;
    if (gamepadPlayerIndex === -1) {
      log.info("No player bound to a gamepad - skipping SDL probe");
    } else if (exists(probeHelperPath)) {
      const probed = runSdlProbe({ helperPath: probeHelperPath, timeoutMs: 1500 });
      log.info("SDL probe result", {
        exitCode: probed.exitCode,
        rawStderr: probed.rawStderr,
        rawStdout: probed.rawStdout,
        guid: probed.learned?.guid,
        hasBinds: !!probed.learned?.binds,
      });
      if (probed.learned?.guid) learnedDevice = probed.learned.guid;
      if (probed.learned?.binds) learnedBinds = probed.learned.binds as LearnedBinds;
    } else {
      log.warn("SDL probe helper still missing after install attempt", { probeHelperPath });
    }

    const ctx = {
      platform: osHandler.getPlatform(),
      consoleId,
      player: 1,
      padPort: 1,
      configDir: path.dirname(bmlPath),
      controllerIds: layout.controllerIds,
      gamepadPlayerIndex,
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