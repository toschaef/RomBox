import path from "path";
import fs from "fs";
import { BaseConfigurator } from "./BaseConfigurator";
import { osHandler } from "../../platform";
import { IniEditor } from "../editors/ini";
import { ControlsService } from "../../services/ControlsService";
import type { Game } from "../../../shared/types";
import { DolphinTranslator } from "../translators/DolphinTranslator";
import type { EmulatorPatch, TranslateContext } from "../translators/ITranslator";
import { DOLPHIN, wiiPortSources } from "../schema/dolphin";
import { SettingsService } from "../../services/SettingsService";
import { getResolutionMultiplier } from "../../../shared/resolution";
import { getPlayerControllerId } from "../../../shared/controls/controllerModels";


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

// NB: no per-game GameSettings/<id>.ini override is written. Dolphin resolves
// those by the disc's 6-character game ID (GameConfigLoader.cpp's
// GetGameIniFilenames), so a file named after RomBox's own internal game UUID
// is never read by anything - port enablement has to live in Dolphin.ini.
const PLAYER_BINDINGS_KEYS = ["player1", "player2", "player3", "player4"] as const;

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

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const layout = await svc.getEffectiveConsoleLayout(this.game.consoleId, profile.id);

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
      // NB: SIDevice0-3 belong in [Core], NOT [Controls] - verified against
      // Dolphin's own Config/MainSettings.cpp:
      //   Info<SIDevices>{{System::Main, "Core", "SIDevice0"}, ...}
      // Writing them under [Controls] (as this used to) is silently ignored,
      // leaving Dolphin's defaults in force: SIDevice0 = SIDEVICE_GC_CONTROLLER
      // and SIDevice1-3 = SIDEVICE_NONE. That's exactly why player 1 appeared
      // to work while players 2-4 never did - their ports were never enabled.
      // Value 6 = SIDEVICE_GC_CONTROLLER, 0 = SIDEVICE_NONE (SI_Device.h enum).
      Core: { BackgroundInput: "True" },
    };

    // Every port is written explicitly (not just the enabled ones) so a port
    // left on by an earlier session - or by Dolphin's own GUI - doesn't stay
    // on forever: Dolphin.ini is patched, not rewritten, so an untouched key
    // keeps its last value.
    const siDevices: string[] = [];
    const wiimoteSources: string[] = [];

    for (let idx = 0; idx < PLAYER_BINDINGS_KEYS.length; idx++) {
      const playerKey = PLAYER_BINDINGS_KEYS[idx];
      // Player 1 always exists; 2-4 only if actually configured.
      const playerExists = idx === 0 || !!layout[playerKey];

      if (this.game.consoleId === "wii") {
        const { siDevice, wiimoteSource } = wiiPortSources(playerExists, getPlayerControllerId(layout, playerKey));
        siDevices.push(siDevice);
        wiimoteSources.push(wiimoteSource);
      } else {
        siDevices.push(playerExists ? "6" : "0");
        wiimoteSources.push("0");
      }

      iniUpdate.Core[`SIDevice${idx}`] = siDevices[idx];
    }

    IniEditor.updateIni(dolphinIni, iniUpdate);

    const gfxIni = path.join(configDir, "GFX.ini");
    IniEditor.updateIni(gfxIni, {
      Settings: { InternalResolution: resScale },
    });

    const effectiveProfile = {
      ...profile,
      preferredControllerId: profile.preferredControllerId,
      player1: layout.player1,
      player2: layout.player2,
      player3: layout.player3,
      player4: layout.player4,
    };

    const ctx: TranslateContext = {
      platform: osHandler.getPlatform(),
      consoleId: this.game.consoleId,
      gameId: this.game.id,
      padPort: 1,
      configDir,
      controllerId: layout.controllerId,
      player2ControllerId: layout.player2ControllerId,
      player3ControllerId: layout.player3ControllerId,
      player4ControllerId: layout.player4ControllerId,
    };

    const translator = new DolphinTranslator();
    const patches = translator.translate(effectiveProfile, ctx);

    this.applyPatches(patches);

    if (this.game.consoleId === "wii") {
      // Wiimote enablement lives in WiimoteNew.ini as [WiimoteN] Source - NOT
      // as Dolphin.ini [Controls] WiimoteSourceN, which is what this used to
      // write and which Dolphin silently ignores. Verified against Dolphin's
      // Config/WiimoteSettings.cpp:
      //   Info<WiimoteSource>{{System::WiiPad, "Wiimote1", "Source"}, ...}
      // with System::WiiPad -> WiimoteNew.ini (CommonPaths.h WIIPAD_CONFIG).
      // Defaults are Wiimote1 = Emulated, Wiimote2-4 = None, which is why
      // player 1 worked by luck while players 2-4 were never enabled at all.
      // Values: 0 = None, 1 = Emulated, 2 = Real (HW/Wiimote.h WiimoteSource).
      const wiiNewPath = DOLPHIN.wiimoteNewPath(configDir);
      const wiimoteSourceUpdate: Record<string, Record<string, string>> = {};
      for (let idx = 0; idx < wiimoteSources.length; idx++) {
        wiimoteSourceUpdate[`Wiimote${idx + 1}`] = { Source: wiimoteSources[idx] };
      }
      IniEditor.updateIni(wiiNewPath, wiimoteSourceUpdate);
    }

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