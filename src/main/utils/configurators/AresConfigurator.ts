import fs from "fs";
import path from "path";
import { BaseConfigurator } from "./BaseConfigurator";
import { osHandler } from "../../platform";
import { ControlsService } from "../../services/ControlsService";
import { BmlEditor } from "../editors/bml";
import { ARES } from "../schema/ares";
import { AresTranslator } from "../translators/AresTranslator";
import { EngineService } from "../../services/EngineService";

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
    const macosDir = path.dirname(enginePath);
    const contentsDir = path.dirname(macosDir);
    const appDir = path.dirname(contentsDir);
    const engineRoot = path.dirname(appDir);

    candidates.push(
      { label: "portable_engineRoot", file: path.join(engineRoot, ARES.settingsFile) },
      { label: "portable_appDir", file: path.join(appDir, ARES.settingsFile) },
      { label: "portable_contents", file: path.join(contentsDir, ARES.settingsFile) },
      { label: "portable_macos", file: path.join(macosDir, ARES.settingsFile) },
      { label: "portable_resources", file: path.join(contentsDir, "Resources", ARES.settingsFile) },
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
    const p1 = await svc.getEffectiveConsoleBindings(consoleId, profile.id);

    const updates = this.translator.translateFromPlayer(p1);

    BmlEditor.updateBml(bmlPath, ["VirtualPad1"], updates);
  }
}