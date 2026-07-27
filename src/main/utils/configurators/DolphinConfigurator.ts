import path from "path";
import fs from "fs";
import { BaseConfigurator } from "./BaseConfigurator";
import { osHandler } from "../../platform";
import { IniEditor } from "../editors/ini";
import { ControlsService } from "../../services/ControlsService";
import type { Game } from "../../../shared/types";
import { DolphinTranslator } from "../translators/DolphinTranslator";
import type { EmulatorPatch, TranslateContext } from "../translators/ITranslator";
import type { PlayerBindings } from "../../../shared/types/controls";
import { DOLPHIN, detectDolphinPadDevice } from "../schema/dolphin";
import { SettingsService } from "../../services/SettingsService";
import { getResolutionMultiplier } from "../../../shared/resolution";


function iniGetAll(text: string, section: string, key: string): string[] {
  const lines = text.split(/\r?\n/);
  let cur = "";
  const out: string[] = [];

  for (const line of lines) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (header) {
      cur = header[1].trim();
      continue;
    }
    if (cur !== section) continue;

    const kv = line.match(/^\s*([^=;#]+?)\s*=\s*(.*?)\s*$/);
    if (!kv) continue;

    const k = kv[1].trim();
    if (k === key) out.push(kv[2]);
  }

  return out;
}

function ensureDirs(configDir: string) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(configDir, "Profiles", "GCPad"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "Profiles", "Wiimote"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "GameSettings"), { recursive: true });
}

function dolphinGameIdFromGame(game: Game): string | undefined {
  return (game as Game & { dolphinGameId?: string }).dolphinGameId;
}

export class DolphinConfigurator extends BaseConfigurator {
  constructor(private game: Game) {
    super();
  }

  async configure(): Promise<void> {
    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    ensureDirs(configDir);
    const dolphinIni = path.join(configDir, "Dolphin.ini");

    const settingsSvc = new SettingsService();
    const fullscreen = settingsSvc.get("launch.fullscreen");
    const fs_flag = fullscreen ? "True" : "False";
    const resolution = settingsSvc.get("launch.resolution");
    const resScale = String(getResolutionMultiplier(resolution, "dolphin"));

    const iniUpdate: any = {
      Display: { RenderToMain: "False", Fullscreen: fs_flag },
      Interface: {
        ShowMainWindow: "False",
        ConfirmStop: "False",
        UsePanicHandlers: "False",
        OnScreenDisplayMessages: "False",
        ShowToolbar: "False",
        ShowStatusbar: "False",
      },
      General: { RecursiveISOPaths: "False" },
      Analytics: { PermissionAsked: "True" },
      Core: { BackgroundInput: "True" },
      Controls: { SIDevice0: "6" },
    };

    if (this.game.consoleId === "wii") {
      iniUpdate.Controls.WiimoteSource0 = "1";
    }

    IniEditor.updateIni(dolphinIni, iniUpdate);

    const gfxIni = path.join(configDir, "GFX.ini");
    IniEditor.updateIni(gfxIni, {
      Settings: { InternalResolution: resScale },
    });

    if (this.game.consoleId === "wii") {
      const wiiNewPath = DOLPHIN.wiimoteNewPath(configDir);
      IniEditor.updateIni(wiiNewPath, {
        Wiimote1: {
          Extension: "Classic",
        },
      });
    }

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();

    const bindings: PlayerBindings = await svc.getEffectiveConsoleBindings(this.game.consoleId, profile.id);

    const detected = detectDolphinPadDevice(configDir);
    const effectiveProfile = {
      ...profile,
      preferredControllerId: profile.preferredControllerId,
      player1: bindings,
    };

    const ctx: TranslateContext = {
      platform: osHandler.getPlatform(),
      consoleId: this.game.consoleId,
      gameId: dolphinGameIdFromGame(this.game),
      player: 1,
      padPort: 1,
      configDir,
    };

    const translator = new DolphinTranslator();
    const patches = translator.translate(effectiveProfile, ctx);

    this.applyPatches(patches);

    if (this.game.consoleId === "wii") {
      try {
        const wiiNew = DOLPHIN.wiimoteNewPath(configDir);
        const wtxt = fs.readFileSync(wiiNew, "utf-8");
        const keys = [
          "Device",
          "Extension",
          "Classic/Buttons/A",
          "Classic/Buttons/+",
          "Classic/D-Pad/Up",
          "Classic/Left Stick/Up",
        ] as const;

        const verifyW: Record<string, { value: string | null; count: number }> = {};
        for (const k of keys) {
          const vals = iniGetAll(wtxt, "Wiimote1", k);
          verifyW[k] = { value: vals.at(-1) ?? null, count: vals.length };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log('[Dolphin] Could not read WiimoteNew.ini', msg);
      }
    }

    const gcNew = DOLPHIN.gcPadNewPath(configDir);
    const text = fs.readFileSync(gcNew, "utf-8");

    const keys = ["Device", "Buttons/A", "Buttons/Start", "Main Stick/Up"] as const;

    const verify: Record<string, { value: string | null; count: number }> = {};
    for (const k of keys) {
      const vals = iniGetAll(text, "GCPad1", k);
      verify[k] = { value: vals.at(-1) ?? null, count: vals.length };
    }
  }
}