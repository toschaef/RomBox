import path from "path";
import fs from "fs";
import { BaseConfigurator } from "./BaseConfigurator";
import { osHandler } from "../../platform";
import { IniEditor } from "../editors/ini";
import { ControlsService } from "../../services/ControlsService";
import type { Game } from "../../../shared/types";
import { DolphinTranslator } from "../translators/DolphinTranslator";
import type { EmulatorPatch, TranslateContext } from "../translators/ITranslator";
import { resolveConsoleBindings } from "../resolveConsoleBindings";
import type { PlayerBindings } from "../../../shared/types/controls";
import { DOLPHIN } from "../schema/dolphin";


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

function detectDolphinPadDevice(configDir: string): string | null {
  const candidates: Array<{ file: string; section: string }> = [
    { file: DOLPHIN.gcPadNewPath(configDir), section: "GCPad1" },
    { file: DOLPHIN.wiimoteNewPath(configDir), section: "Wiimote1" },
  ];

  for (const c of candidates) {
    try {
      if (!fs.existsSync(c.file)) continue;
      const txt = fs.readFileSync(c.file, "utf-8");
      const dev = iniGetAll(txt, c.section, "Device").at(-1)?.trim();
      if (!dev) continue;

      if (dev.includes("Keyboard") || dev.includes("Quartz") || dev.includes("Keyboard & Mouse")) continue;

      return dev;
    } catch (err) {
      void err;
    }
  }
  return null;
}

function ensureDirs(configDir: string) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(configDir, "Profiles", "GCPad"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "Profiles", "Wiimote"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "GameSettings"), { recursive: true });
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

function dolphinGameIdFromGame(game: Game): string | undefined {
  return (game as any).dolphinGameId as string | undefined;
}

export class DolphinConfigurator extends BaseConfigurator {
  constructor(private game: Game) {
    super();
  }

  async configure(): Promise<void> {
    const configDir = osHandler.getEmulatorConfigPath("dolphin");
    ensureDirs(configDir);
    const dolphinIni = path.join(configDir, "Dolphin.ini");

    IniEditor.updateIni(dolphinIni, {
      Display: { RenderToMain: "False", Fullscreen: "False" },
      Interface: {
        ShowMainWindow: "False",
        ConfirmStop: "False",
        UsePanicHandlers: "False",
        OnScreenDisplayMessages: "False",
        ShowToolbar: "False",
        ShowStatusbar: "False",
      },
      General: { RecursiveISOPaths: "False" },
    });

    if (this.game.consoleId === "wii") {
      IniEditor.updateIni(dolphinIni, {
        Controls: {
          WiimoteSource0: "1",
        },
      });

      const wiiNewPath = DOLPHIN.wiimoteNewPath(configDir);

      IniEditor.updateIni(wiiNewPath, {
        Wiimote1: {
          Extension: "Classic",
        },
      });
    }

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const consoleLayout = svc.getConsoleLayout(this.game.consoleId, profile.id);

    const bindings: PlayerBindings = await resolveConsoleBindings({
      consoleId: this.game.consoleId,
      profile,
      consoleLayout: consoleLayout,
    });

    const detected = detectDolphinPadDevice(configDir);
    const effectiveProfile = {
      ...profile,
      preferredControllerId: profile.preferredControllerId ?? detected ?? profile.preferredControllerId,
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

    applyPatches(patches);

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

        const verifyW: any = {};
        for (const k of keys) {
          const vals = iniGetAll(wtxt, "Wiimote1", k);
          verifyW[k] = { value: vals.at(-1) ?? null, count: vals.length };
        }
      } catch (err) {
        console.log('[Dolphin] Could not read WiimoteNew.ini', err.message);
      }
    }

    const gcNew = DOLPHIN.gcPadNewPath(configDir);
    const text = fs.readFileSync(gcNew, "utf-8");

    const keys = ["Device", "Buttons/A", "Buttons/Start", "Main Stick/Up"] as const;

    const verify: any = {};
    for (const k of keys) {
      const vals = iniGetAll(text, "GCPad1", k);
      verify[k] = { value: vals.at(-1) ?? null, count: vals.length };
    }
  }
}