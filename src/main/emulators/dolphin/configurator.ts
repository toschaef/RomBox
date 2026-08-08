import path from "path";
import fs from "fs";
import { BaseConfigurator } from "../BaseConfigurator";
import { osHandler } from "../../platform";
import { IniEditor } from "../../utils/editors/ini";
import type { Game } from "../../../shared/types";
import { DolphinTranslator } from "./translator";
import type { TranslateContext } from "../translatorTypes";
import { DOLPHIN, wiiPortSources } from "./schema";
import { settingsService } from "../../services/SettingsService";
import { getResolutionMultiplier } from "../../../shared/resolution";
import { getPlayerControllerId, getDefaultControllerId } from "../../../shared/controls/controllerModels";


function ensureDirs(configDir: string) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(configDir, "Profiles", "GCPad"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "Profiles", "Wiimote"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "GameSettings"), { recursive: true });
}

const PLAYER_BINDINGS_KEYS = ["player1", "player2", "player3", "player4"] as const;

export class DolphinConfigurator extends BaseConfigurator {
  constructor(private game: Game) {
    super();
  }

  async configure(): Promise<void> {
    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    ensureDirs(configDir);
    const dolphinIni = path.join(configDir, "Dolphin.ini");

    const settingsSvc = settingsService;
    const fullscreen = settingsSvc.get("launch.fullscreen");
    const fs_flag = fullscreen ? "True" : "False";
    const resolution = settingsSvc.get("launch.resolution");
    const resScale = String(getResolutionMultiplier(resolution, "dolphin"));

    const { layout, effectiveProfile } = await this.resolveControls(this.game.consoleId);

    const iniUpdate: Record<string, Record<string, string>> = {
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
    };

    const siDevices: string[] = [];
    const wiimoteSources: string[] = [];

    for (let idx = 0; idx < PLAYER_BINDINGS_KEYS.length; idx++) {
      const playerKey = PLAYER_BINDINGS_KEYS[idx];
      const playerExists = idx === 0 || !!layout[playerKey];

      if (this.game.consoleId === "wii") {
        const controllerId = getPlayerControllerId(layout, playerKey) ?? getDefaultControllerId("wii");
        const { siDevice, wiimoteSource } = wiiPortSources(playerExists, controllerId);
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

    const ctx: TranslateContext = {
      platform: osHandler.getPlatform(),
      consoleId: this.game.consoleId,
      gameId: this.game.id,
      padPort: 1,
      configDir,
      controllerIds: layout.controllerIds,
    };

    const translator = new DolphinTranslator();
    const patches = translator.translate(effectiveProfile, ctx);

    this.applyPatches(patches);

    if (this.game.consoleId === "wii") {
      const wiiNewPath = DOLPHIN.wiimoteNewPath(configDir);
      const wiimoteSourceUpdate: Record<string, Record<string, string>> = {};
      for (let idx = 0; idx < wiimoteSources.length; idx++) {
        wiimoteSourceUpdate[`Wiimote${idx + 1}`] = { Source: wiimoteSources[idx] };
      }
      IniEditor.updateIni(wiiNewPath, wiimoteSourceUpdate);
    }

  }
}