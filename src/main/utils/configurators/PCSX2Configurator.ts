import path from "path";
import fs from "fs";
import { BaseConfigurator } from "./BaseConfigurator";
import { osHandler } from "../../platform";
import { IniEditor } from "../editors/ini";
import { ControlsService } from "../../services/ControlsService";
import { PCSX2Translator } from "../translators/PCSX2Translator";
import type { EmulatorPatch, TranslateContext } from "../translators/ITranslator";
import { PCSX2 } from "../schema/pcsx2";
import { SettingsService } from "../../services/SettingsService";
import { getResolutionMultiplier } from "../../../shared/resolution";

function ensureDirs(configDir: string) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(configDir, "inis"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "bios"), { recursive: true });
}

const PCSX2_VALID_BIOS = [
  "scph10000.bin", "scph30001.bin", "scph30004.bin",
  "scph39001.bin", "scph39004.bin", "scph50000.bin",
  "scph70000.bin", "scph70004.bin", "scph70012.bin",
  "scph77001.bin", "scph77004.bin", "scph90006.bin",
  "bios.bin", "ps2_bios.bin",
];

export class PCSX2Configurator extends BaseConfigurator {
  async configure(): Promise<void> {
    const platform = osHandler.getPlatform();
    const homeDir = this.getHomeDir();
    const configDir = PCSX2.getConfigDir(platform, homeDir);

    ensureDirs(configDir);

    const pcsx2Ini = PCSX2.iniPath(configDir);
    const biosDir = path.join(configDir, "bios");

    const biosFile = this.findBiosFile(biosDir, PCSX2_VALID_BIOS);

    const settingsSvc = new SettingsService();
    const fullscreen = settingsSvc.get("launch.fullscreen");
    const fs_flag = fullscreen ? "true" : "false";
    const resolution = settingsSvc.get("launch.resolution");
    const resScale = String(getResolutionMultiplier(resolution, "pcsx2"));

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const layout = await svc.getEffectiveConsoleLayout("ps2", profile.id);

    // PCSX2 only instantiates a controller for a port whose [PadN] Type is not
    // "None" - bindings written under a None-typed port are silently ignored
    // (see Pad::LoadConfig). Pad3/Pad4 additionally require multitap on port 1
    // (ini key MultitapPort1 in the [Pad] section), since they map to that
    // port's multitap slots (see Pad::GetConfigSection / Pad::LoadConfig).
    const hasPlayer2 = !!layout.player2;
    const hasPlayer3 = !!layout.player3;
    const hasPlayer4 = !!layout.player4;

    const iniConfig: Record<string, Record<string, string>> = {
      UI: {
        StartFullscreen: fs_flag,
        HideMouseCursor: "true",
        ConfirmShutdown: "false",
        HideCursorOnIdle: "true",
        SettingsVersion: "1",
        DoubleClickTogglesFullscreen: "false",
      },
      EmuCore: {
        EnableFastBoot: "true",
      },
      "EmuCore/GS": {
        upscale_multiplier: resScale,
      },
      Graphics: {
        DefaultToFullscreen: fs_flag,
      },
      AutoUpdater: {
        CheckAtStartup: "false",
      },
      InputSources: {
        SDL: "true",
      },
      Pad: {
        MultitapPort1: hasPlayer3 || hasPlayer4 ? "true" : "false",
      },
      Pad1: {
        Type: "DualShock2",
      },
      Pad2: {
        Type: hasPlayer2 ? "DualShock2" : "None",
      },
      Pad3: {
        Type: hasPlayer3 ? "DualShock2" : "None",
      },
      Pad4: {
        Type: hasPlayer4 ? "DualShock2" : "None",
      },
    };

    if (biosFile) {
      iniConfig.Filenames = {
        BIOS: biosFile,
      };
    }

    IniEditor.updateIni(pcsx2Ini, iniConfig);

    const effectiveProfile = {
      ...profile,
      preferredControllerId: profile.preferredControllerId,
      player1: layout.player1,
      player2: layout.player2,
      player3: layout.player3,
      player4: layout.player4,
    };

    const ctx: TranslateContext = {
      platform,
      consoleId: "ps2",
      player: 1,
      padPort: 1,
      configDir,
      controllerId: layout.controllerId,
    };

    const translator = new PCSX2Translator();
    const patches = translator.translate(effectiveProfile, ctx);

    this.applyPatches(patches);
  }
}
