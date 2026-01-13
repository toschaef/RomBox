import path from "path";
import fs from "fs";
import { BaseConfigurator } from "./BaseConfigurator";
import { osHandler } from "../../platform";
import { IniEditor } from "../editors/ini";
import { ControlsService } from "../../services/ControlsService";
import { PCSX2Translator } from "../translators/PCSX2Translator";
import type { EmulatorPatch, TranslateContext } from "../translators/ITranslator";
import { resolveConsoleBindings } from "../resolveConsoleBindings";
import type { PlayerBindings } from "../../../shared/types/controls";
import { PCSX2 } from "../schema/pcsx2";

function ensureDirs(configDir: string) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(configDir, "inis"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "bios"), { recursive: true });
}

function applyPatches(patches: EmulatorPatch[]) {
  for (const p of patches) {
    if (p.kind === "ini-set") {
      IniEditor.updateIni(p.absPath, { [p.section]: { [p.key]: p.value } });
      continue;
    }

    if (p.kind === "file-write") {
      fs.mkdirSync(path.dirname(p.absPath), { recursive: true });
      fs.writeFileSync(p.absPath, p.contents, "utf-8");
      continue;
    }

    if (p.kind === "ini-delete") {
      IniEditor.deleteKeys(p.absPath, { [p.section]: [p.key] });
      continue;
    }
  }
}

function findBiosFile(biosDir: string): string | null {
  const validBiosNames = [
    "scph10000.bin", "scph30001.bin", "scph30004.bin",
    "scph39001.bin", "scph39004.bin", "scph50000.bin",
    "scph70000.bin", "scph70004.bin", "scph70012.bin",
    "scph77001.bin", "scph77004.bin", "scph90006.bin",
    "bios.bin", "ps2_bios.bin",
  ];

  if (!fs.existsSync(biosDir)) return null;

  for (const name of validBiosNames) {
    if (fs.existsSync(path.join(biosDir, name))) {
      return name;
    }
  }

  try {
    const files = fs.readdirSync(biosDir);
    const biosFile = files.find(f =>
      f.toLowerCase().endsWith(".bin") &&
      (f.toLowerCase().startsWith("scph") || f.toLowerCase().includes("bios"))
    );
    return biosFile || null;
  } catch {
    return null;
  }
}

export class PCSX2Configurator extends BaseConfigurator {
  async configure(): Promise<void> {
    const platform = osHandler.getPlatform();
    const homeDir = this.getHomeDir();
    const configDir = PCSX2.getConfigDir(platform, homeDir);

    ensureDirs(configDir);

    const pcsx2Ini = PCSX2.iniPath(configDir);
    const biosDir = path.join(configDir, "bios");

    const biosFile = findBiosFile(biosDir);

    const iniConfig: Record<string, Record<string, string>> = {
      UI: {
        StartFullscreen: "false",
        HideMouseCursor: "true",
        ConfirmShutdown: "false",
        HideCursorOnIdle: "true",
        SettingsVersion: "1",
      },
      EmuCore: {
        EnableFastBoot: "true",
      },
      Graphics: {
        DefaultToFullscreen: "false",
        DoubleClickToFullscreen: "false",
      },
      AutoUpdater: {
        CheckAtStartup: "false",
      },
      InputSources: {
        SDL: "true",
      },
      Pad1: {
        Type: "DualShock2",
      },
      Pad2: {
        Type: "None",
      },
    };

    if (biosFile) {
      iniConfig.Filenames = {
        BIOS: biosFile,
      };
    }

    IniEditor.updateIni(pcsx2Ini, iniConfig);

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const consoleLayout = svc.getConsoleLayout("ps2", profile.id);

    const bindings: PlayerBindings = await resolveConsoleBindings({
      consoleId: "ps2",
      profile,
      consoleLayout: consoleLayout,
    });

    const effectiveProfile = {
      ...profile,
      player1: bindings,
    };

    const ctx: TranslateContext = {
      platform,
      consoleId: "ps2",
      player: 1,
      padPort: 1,
      configDir,
    };

    const translator = new PCSX2Translator();
    const patches = translator.translate(effectiveProfile, ctx);

    applyPatches(patches);
  }
}
