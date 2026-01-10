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
function statSafe(p: string) { try { return fs.statSync(p); } catch { return null; } }

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

function extractSection(text: string, sectionName: string): string | null {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.trim() === sectionName && !l.startsWith(" "));
  if (headerIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const ln = lines[i];
    const isTopHeader = ln.trim().length > 0 && !ln.startsWith(" ") && !ln.includes(":");
    if (isTopHeader) { endIdx = i; break; }
  }
  return lines.slice(headerIdx, endIdx).join("\n");
}

export class AresConfigurator extends BaseConfigurator {
  private translator = new AresTranslator();

  async configure(): Promise<void> {
    const enginePath = await EngineService.getEnginePath('ares');
    console.log(`[ares][config] enginePath=${enginePath ?? "(null)"}`);

    const { candidates, existing } = pickSettingsPath(enginePath ?? null);

    console.log("[ares][config] settings.bml candidates:");
    for (const c of candidates) {
      const st = statSafe(c.file);
      console.log(`  - ${c.label}: ${c.file} exists=${exists(c.file)} size=${st ? st.size : "n/a"}`);
    }

    let bmlPath: string;
    if (existing.length) {
      const nonSupport = existing.find((e) => e.label !== "appSupport") ?? existing[0];
      bmlPath = nonSupport.file;
    } else {
      const portableEngineRoot = candidates.find((c) => c.label === "portable_engineRoot");
      bmlPath = (portableEngineRoot ?? candidates[0]).file;
      ensureDirForFile(bmlPath);
      fs.writeFileSync(bmlPath, "");
      console.log(`[ares][config] created empty settings at: ${bmlPath}`);
    }

    console.log(`[ares][config] using settings path: ${bmlPath}`);

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const consoleId = "n64" as const;
    const p1 = await svc.getEffectiveConsoleBindings(consoleId, profile.id);

    console.log("[ares][config] effective p1 =", JSON.stringify(p1, null, 2));

    const tx = new AresTranslator();

    const updates = this.translator.translateFromPlayer(p1);
    console.log("[ares][config] updates keys =", Object.keys(updates));
    console.log("[ares][config] sample =", Object.entries(updates).slice(0, 12));

    console.log("[ares][config] updates count =", Object.keys(updates).length);

    console.log("[ares][config] p1 snapshot:", {
      moveType: p1.move.type,
      lookType: p1.look.type,
      face: p1.face,
      system: p1.system,
      dpad: p1.dpad,
    });

    console.log("[ares][config] updates count=", Object.keys(updates).length);
    console.log("[ares][config] updates sample=", Object.entries(updates).slice(0, 8));

    BmlEditor.updateBml(bmlPath, ["VirtualPad1"], updates);

    const after = fs.readFileSync(bmlPath, "utf-8");
    console.log("[ares][config] AFTER write: has Pad.Up =", after.includes("Pad.Up: 0x1/0/"));
    console.log("[ares][config] AFTER write: has A..South =", after.includes("A..South: 0x1/0/"));

    const i = after.indexOf("\nVirtualPad1\n");
    console.log(
      "[ares][config] AFTER write VirtualPad1 snippet:\n" +
        (i === -1 ? "(missing VirtualPad1 header?)" : after.slice(i, i + 700))
    );

  }
}