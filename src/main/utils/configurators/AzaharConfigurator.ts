import fs from "fs";
import path from "path";
import type { EmulatorConfigurator } from "./types";
import { osHandler } from "../../platform";
import { IniEditor } from "../editors/ini";
import { ControlsService } from "../../services/ControlsService";
import {
  AZAHAR,
  azActiveProfileKey,
  azActiveProfileDefaultKey,
  azProfilesSizeKey,
  azProfileKey,
  azProfileDefaultKey,
  azTouchMapsSizeKey,
  azTouchMapKey,
  azTouchMapDefaultKey,
  azTouchMapEntriesSizeKey,
} from "../schema/azahar";
import type { EmulatorPatch, TranslateContext } from "../translators/ITranslator";
import { AzaharTranslator } from "../translators/AzaharTranslator";
import type { AzaharLearnedSDL } from "../azahar/sdlprobe";
import { runAzaharSdlProbe } from "../azahar/sdlprobe";
import { SettingsService } from "../../services/SettingsService";


function ensureQtConfigFile(configDir: string): string {
  fs.mkdirSync(configDir, { recursive: true });
  const qtIni = path.join(configDir, AZAHAR.iniFileName);
  if (!fs.existsSync(qtIni)) fs.writeFileSync(qtIni, "[Controls]\n", "utf-8");
  return qtIni;
}

function readTextIfExists(p: string) {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
}

function extractIniSection(text: string, section: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inSec = false;
  for (const line of lines) {
    const m = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (m) {
      const name = m[1].trim();
      if (inSec) break;
      inSec = name === section;
      if (inSec) out.push(line);
      continue;
    }
    if (inSec) out.push(line);
  }
  return out.join("\n");
}

function parseIniSectionKV(sectionText: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of sectionText.split(/\r?\n/)) {
    const kv = line.match(/^\s*([^=]+?)\s*=\s*(.*?)\s*$/);
    if (!kv) continue;
    out[kv[1].trim()] = kv[2].trim();
  }
  return out;
}

function patchesToIniUpdates(patches: EmulatorPatch[]): Record<string, Record<string, string>> {
  const updates: Record<string, Record<string, string>> = {};
  for (const p of patches) {
    if (p.kind !== "ini-set") continue;
    updates[p.section] ??= {};
    updates[p.section][p.key] = p.value;
  }
  return updates;
}

function readCachedLearned(cachePath: string): AzaharLearnedSDL | null {
  try {
    if (!fs.existsSync(cachePath)) return null;
    const data = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as AzaharLearnedSDL;
    if (!data?.ok || !data.guid || !data.binds) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCachedLearned(cachePath: string, learned: AzaharLearnedSDL): void {
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(learned, null, 2), "utf-8");
  } catch (err) {
    void err;
  }
}

const REQUIRED_BUTTON_KEYS = [
  AZAHAR.keys.button_a, AZAHAR.keys.button_b, AZAHAR.keys.button_x, AZAHAR.keys.button_y,
  AZAHAR.keys.button_up, AZAHAR.keys.button_down, AZAHAR.keys.button_left, AZAHAR.keys.button_right,
  AZAHAR.keys.button_l, AZAHAR.keys.button_r, AZAHAR.keys.button_start, AZAHAR.keys.button_select,
  AZAHAR.keys.button_debug, AZAHAR.keys.button_gpio14,
  AZAHAR.keys.button_zl, AZAHAR.keys.button_zr,
  AZAHAR.keys.button_home, AZAHAR.keys.button_power,
] as const;

const REQUIRED_ANALOG_KEYS = [AZAHAR.keys.circle_pad, AZAHAR.keys.c_stick] as const;

const REQUIRED_META_KEYS = [
  AZAHAR.keys.motion_device,
  AZAHAR.keys.touch_device,
  AZAHAR.keys.use_touch_from_button,
  AZAHAR.keys.touch_from_button_map,
  AZAHAR.keys.udp_input_address,
  AZAHAR.keys.udp_input_port,
  AZAHAR.keys.udp_pad_index,
] as const;

const META_DEFAULTS: Record<(typeof REQUIRED_META_KEYS)[number], string> = {
  motion_device: `"engine:motion_emu,update_period:100,sensitivity:0.01,tilt_clamp:90.0"`,
  touch_device: `engine:emu_window`,
  use_touch_from_button: "false",
  touch_from_button_map: "0",
  udp_input_address: "127.0.0.1",
  udp_input_port: "26760",
  udp_pad_index: "0",
};

function normalizeParam(v: string | undefined): string {
  const t = (v ?? "").trim();
  return t.length === 0 ? AZAHAR.paramEmpty : t;
}

function buildControlsSection(args: {
  rawControls: Record<string, string>;
  preKV: Record<string, string>;
}) {
  const { rawControls, preKV } = args;
  const idx = AZAHAR.activeProfileIndex;

  const out: Record<string, string> = {};

  out[azActiveProfileKey()] = String(idx);
  out[azActiveProfileDefaultKey()] = "false";

  out[azProfilesSizeKey()] = "1";
  out[`${azProfilesSizeKey()}\\default`] = "false";

  out[azTouchMapsSizeKey()] = "1";
  out[`${azTouchMapsSizeKey()}\\default`] = "false";
  out[azTouchMapKey(0, "name")] = "default";
  out[azTouchMapDefaultKey(0, "name")] = "true";
  out[azTouchMapEntriesSizeKey(0)] = "0";

  const pick = (key: string): string | undefined => {
    const k = azProfileKey(idx, key);
    return rawControls[k] ?? preKV[k];
  };

  const set = (key: string, value: string, defFlag: "true" | "false" = "false") => {
    out[azProfileKey(idx, key)] = value;
    out[azProfileDefaultKey(idx, key)] = defFlag;
  };

  set("name", AZAHAR.profileName, "false");

  for (const k of REQUIRED_BUTTON_KEYS) set(k, normalizeParam(pick(k)));
  for (const k of REQUIRED_ANALOG_KEYS) set(k, normalizeParam(pick(k)));

  for (const k of REQUIRED_META_KEYS) set(k, (pick(k) ?? META_DEFAULTS[k]).trim(), "false");

  return out;
}

export class AzaharConfigurator implements EmulatorConfigurator {
  async configure(): Promise<void> {
    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const bindings3ds = await svc.getEffectiveConsoleBindings("3ds", profile.id);

    const configDir = osHandler.getEmulatorConfigPath("azahar");
    const qtIniPath = ensureQtConfigFile(configDir);

    const helperPath = path.join(configDir, "rombox-azahar-sdlprobe");
    const cachePath = path.join(configDir, "rombox-azahar-learned.json");

    const preText = readTextIfExists(qtIniPath);
    const preControlsText = extractIniSection(preText, "Controls");
    const preKV = preControlsText ? parseIniSectionKV(preControlsText) : {};

    let learned = readCachedLearned(cachePath);
    if (fs.existsSync(helperPath)) {
      const res = runAzaharSdlProbe({
        helperPath,
        timeoutMs: 1500,
        preferredGuid: profile.preferredControllerId,
      });
      if (res.learned) {
        learned = res.learned;
        writeCachedLearned(cachePath, learned);
      }
    }

    const translator = new AzaharTranslator(learned ?? null);
    const ctx: TranslateContext = { platform: osHandler.getPlatform(), player: 1, padPort: 1 };

    const patches = translator.translate({
      bindings: bindings3ds,
      ctx,
    });

    patches.push({ kind: "ini-set", section: AZAHAR.sections.ui, key: "confirmClose", value: "false" });
    patches.push({ kind: "ini-set", section: AZAHAR.sections.ui, key: "confirmClose\\default", value: "false" });

    patches.push({ kind: "ini-set", section: AZAHAR.sections.ui, key: "Paths\\language", value: "en" });
    patches.push({ kind: "ini-set", section: AZAHAR.sections.ui, key: "Paths\\language\\default", value: "false" });

    patches.push({ kind: "ini-set", section: "Miscellaneous", key: "check_for_update_on_start", value: "false" });
    patches.push({ kind: "ini-set", section: "Miscellaneous", key: "check_for_update_on_start\\default", value: "false" });

    patches.push({ kind: "ini-set", section: "UI", key: "showStatusBar", value: "false" });
    patches.push({ kind: "ini-set", section: "UI", key: "showStatusBar\\default", value: "false" });

    const settingsSvc = new SettingsService();
    const fullscreen = settingsSvc.get("launch.fullscreen");
    const fs_flag = fullscreen ? "true" : "false";
    patches.push({ kind: "ini-set", section: "UI", key: "fullscreen", value: fs_flag });
    patches.push({ kind: "ini-set", section: "UI", key: "fullscreen\\default", value: "false" });

    patches.push({ kind: "ini-set", section: "UI", key: "show_advanced_frametime_info", value: "false" });
    patches.push({ kind: "ini-set", section: "UI", key: "show_advanced_frametime_info\\default", value: "false" });


    const updates = patchesToIniUpdates(patches);
    const rawControls = updates[AZAHAR.sections.controls] ?? {};
    const uiUpdates = updates[AZAHAR.sections.ui] ?? {};
    const miscUpdates = updates["Miscellaneous"] ?? {};

    const controls = buildControlsSection({ rawControls, preKV });

    IniEditor.overwriteSection(qtIniPath, "Controls", controls, { format: "compact" });
    IniEditor.updateIni(qtIniPath, { UI: uiUpdates }, { format: "compact" });
    IniEditor.updateIni(qtIniPath, { Miscellaneous: miscUpdates }, { format: "compact" });
  }
}