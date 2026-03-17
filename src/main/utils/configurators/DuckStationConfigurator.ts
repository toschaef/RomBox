import path from "path";
import fs from "fs";
import { BaseConfigurator } from "./BaseConfigurator";
import { osHandler } from "../../platform";
import { IniEditor } from "../editors/ini";
import { ControlsService } from "../../services/ControlsService";
import { DuckStationTranslator } from "../translators/DuckStationTranslator";
import type { EmulatorPatch, TranslateContext } from "../translators/ITranslator";
import { resolveConsoleBindings } from "../resolveConsoleBindings";
import type { PlayerBindings } from "../../../shared/types/controls";
import { DuckStation } from "../schema/duckstation";
import { SettingsService } from "../../services/SettingsService";
import { getResolutionMultiplier } from "../../../shared/resolution";

function ensureDirs(configDir: string) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(configDir, "bios"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "memcards"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "savestates"), { recursive: true });
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
    "scph1001.bin", "scph5500.bin", "scph5501.bin",
    "scph5502.bin", "scph7502.bin", "ps1_bios.bin",
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

export class DuckStationConfigurator extends BaseConfigurator {
  async configure(): Promise<void> {
    const platform = osHandler.getPlatform();
    const configDir = osHandler.getEmulatorBasePath("duckstation");

    ensureDirs(configDir);

    const settingsIni = DuckStation.iniPath(configDir);
    const biosDir = path.join(configDir, "bios");

    const settingsSvc = new SettingsService();
    const fullscreen = settingsSvc.get("launch.fullscreen");
    const fs_flag = fullscreen ? "true" : "false";
    const resolution = settingsSvc.get("launch.resolution");
    const resScale = String(getResolutionMultiplier(resolution, "duckstation"));

    const biosFile = findBiosFile(biosDir);

    const pathNtscU = biosFile ? path.join(biosDir, biosFile) : "";

    if (biosFile) {
      try {
        fs.statSync(pathNtscU);
      } catch (err) {
        void err;
      }
    }

    const iniConfig: Record<string, Record<string, string>> = {
      Main: {
        SetupWizardIncomplete: "false",
        SettingsVersion: "3",
        EmulationSpeed: "1.0",
        FastForwardSpeed: "0.0",
        TurboSpeed: "0.0",
        SyncToHostRefreshRate: "false",
        IncreaseTimerResolution: "true",
        InhibitScreensaver: "true",
        StartPaused: "false",
        StartFullscreen: fs_flag,
        StartInFullscreen: fs_flag,
        ShowStatusBar: "false",
        DoubleClickTogglesFullscreen: "false",
        PauseOnFocusLoss: "false",
        PauseOnMenu: "true",
        SaveStateOnExit: "true",
        CreateSaveStateBackups: "true",
        CompressSaveStates: "true",
        ConfirmPowerOff: "false",
        LoadDevicesFromSaveStates: "false",
        ApplyCompatibilitySettings: "true",
        ApplyGameSettings: "true",
        AutoLoadCheats: "true",
        DisableAllEnhancements: "false",
        RewindEnable: "false",
        RewindFrequency: "10.0",
        RewindSaveSlots: "10",
        RunaheadFrameCount: "0",
      },
      Console: {
        Region: "Auto",
        Enable8MBRAM: "false",
      },
      BIOS: {
        SearchDirectory: biosDir,
        PathNTSCU: "",
        PathNTSCJ: "",
        PathPAL: "",
        PatchFastBoot: "true",
        PatchTTYEnable: "false",
      },
      GPU: {
        Renderer: "Auto",
        Adapter: "",
        ResolutionScale: resScale,
        Multisamples: "1",
        UseDebugDevice: "false",
        PerSampleShading: "false",
        UseThread: "true",
        UseSoftwareRendererForReadbacks: "false",
        TrueColor: "false",
        ScaledDithering: "true",
        TextureFilter: "Nearest",
        DownsampleMode: "Disabled",
        DisableInterlacing: "true",
        ForceNTSCTimings: "false",
        WidescreenHack: "false",
        ChromaSmoothing24Bit: "false",
        PGXPEnable: "false",
        PGXPCulling: "true",
        PGXPTextureCorrection: "true",
        PGXPColorCorrection: "false",
        PGXPVertexCache: "false",
        PGXPCPU: "false",
        PGXPPreserveProjFP: "false",
        PGXPTolerance: "-1.0",
        PGXPDepthBuffer: "false",
        PGXPDepthClearThreshold: "300.0",
      },
      Display: {
        CropMode: "Overscan",
        ActiveStartOffset: "0",
        ActiveEndOffset: "0",
        LineStartOffset: "0",
        LineEndOffset: "0",
        Force4_3For24Bit: "false",
        AspectRatio: "Auto",
        Alignment: "Center",
        CustomAspectRatioNumerator: "0",
        LinearFiltering: "true",
        IntegerScaling: "false",
        Stretch: "false",
        PostProcessing: "false",
        ShowOSDMessages: "false",
        ShowStatusBar: "false",
        ShowFPS: "false",
        ShowSpeed: "false",
        ShowResolution: "false",
        ShowCPU: "false",
        ShowGPU: "false",
        ShowFrameTimes: "false",
        ShowStatusIndicators: "false",
        ShowInputs: "false",
        ShowEnhancements: "false",
        Fullscreen: fs_flag,
        StartFullscreen: fs_flag,
        DoubleClickTogglesFullscreen: "false",
        StretchVertically: "false",
      },
      Audio: {
        Backend: "Default",
        Driver: "",
        OutputDevice: "",
        StretchMode: "TimeStretch",
        BufferMS: "50",
        OutputLatencyMS: "20",
        OutputMuted: "false",
        OutputVolume: "100",
        FastForwardVolume: "100",
      },
      Controller1: {
        Type: "AnalogController",
      },
      Controller2: {
        Type: "None",
      },
      MemoryCards: {
        Card1Type: "PerGameTitle",
        Card1Path: "",
        Card2Type: "None",
        Card2Path: "",
        UsePlaylistTitle: "true",
      },
      ControllerPorts: {
        MultitapMode: "Disabled",
      },
      Hotkeys: {
        FastForward: "",
        TogglePause: "",
        Screenshot: "",
        ToggleFullscreen: "",
        OpenPauseMenu: "",
        LoadSelectedSaveState: "",
        SaveSelectedSaveState: "",
        SelectPreviousSaveStateSlot: "",
        SelectNextSaveStateSlot: "",
        Rewind: "",
        ToggleOverclocking: "",
        ToggleSoftwareRendering: "",
        TogglePGXP: "",
        IncreaseResolutionScale: "",
        DecreaseResolutionScale: "",
        TogglePostProcessing: "",
        ReloadPostProcessingShaders: "",
        ReloadTextureReplacements: "",
        ToggleWidescreen: "",
        TogglePGXPDepth: "",
        TogglePGXPCPU: "",
        AudioMute: "",
        AudioVolumeUp: "",
        AudioVolumeDown: "",
        LoadGlobalState1: "",
        LoadGlobalState2: "",
        LoadGlobalState3: "",
        LoadGlobalState4: "",
        LoadGlobalState5: "",
        LoadGlobalState6: "",
        LoadGlobalState7: "",
        LoadGlobalState8: "",
        LoadGlobalState9: "",
        LoadGlobalState10: "",
        SaveGlobalState1: "",
        SaveGlobalState2: "",
        SaveGlobalState3: "",
        SaveGlobalState4: "",
        SaveGlobalState5: "",
        SaveGlobalState6: "",
        SaveGlobalState7: "",
        SaveGlobalState8: "",
        SaveGlobalState9: "",
        SaveGlobalState10: "",
        LoadGameState1: "",
        LoadGameState2: "",
        LoadGameState3: "",
        LoadGameState4: "",
        LoadGameState5: "",
        LoadGameState6: "",
        LoadGameState7: "",
        LoadGameState8: "",
        LoadGameState9: "",
        LoadGameState10: "",
        SaveGameState1: "",
        SaveGameState2: "",
        SaveGameState3: "",
        SaveGameState4: "",
        SaveGameState5: "",
        SaveGameState6: "",
        SaveGameState7: "",
        SaveGameState8: "",
        SaveGameState9: "",
        SaveGameState10: "",
      },
      InputSources: {
        SDL: "true",
        SDLControllerEnhancedMode: "false",
        Evdev: "false",
        XInput: "false",
        RawInput: "false",
      },
      Pad1: {
        Type: "AnalogController",
      },
      Pad2: {
        Type: "None",
      },
      AutoUpdater: {
        CheckAtStartup: "false",
      },
      UI: {
        ShowStatusBar: "false",
      },
    };

    IniEditor.updateIni(settingsIni, iniConfig);

    const svc = new ControlsService();
    const profile = svc.getDefaultProfile();
    const consoleLayout = svc.getConsoleLayout("ps1", profile.id);

    const bindings: PlayerBindings = await resolveConsoleBindings({
      consoleId: "ps1",
      profile,
      consoleLayout: consoleLayout,
    });

    const effectiveProfile = {
      ...profile,
      player1: bindings,
    };

    const ctx: TranslateContext = {
      platform,
      consoleId: "ps1",
      player: 1,
      padPort: 1,
      configDir,
    };

    const translator = new DuckStationTranslator();
    const patches = translator.translate(effectiveProfile, ctx);

    applyPatches(patches);
  }
}
