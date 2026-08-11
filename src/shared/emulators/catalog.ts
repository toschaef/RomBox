// the single source of truth for emulator and console *facts*
import type { ConsoleID } from "../types";
import type { EngineID } from "../types/engines";
import type { BiosFile } from "../types/bios";

export interface ConsoleBiosCatalog {
  files: BiosFile[];
  /** at least one file must be present for games to run */
  required?: boolean;
  /** any single file satisfies the requirement (e.g. regional PS1 BIOSes) */
  onlyNeedOne?: boolean;
  label?: string;
}

/** A fixed byte sequence that identifies a disc image by header. */
export interface RomSignature {
  offset: number;
  bytes: number[];
}

export interface ConsoleCatalogEntry {
  consoleId: ConsoleID;
  /** human-readable console name, e.g. "GameCube" */
  displayName: string;
  engineId: EngineID;
  /** every extension the drop target accepts for this console */
  extensions: string[];
  // the subset of `extensions` that alone determines the console
  identifiedBy?: string[];
  bios?: ConsoleBiosCatalog;
  /** header signature used by the disc identifier */
  signature?: RomSignature;
  // libretro-thumbnails repositories holding this console's box art, most
  coverRepos?: string[];
}

export interface EngineCatalogEntry {
  engineId: EngineID;
  /** human-readable emulator name, e.g. "Mesen 2" */
  displayName: string;
}

export const ENGINE_CATALOG: Record<EngineID, EngineCatalogEntry> = {
  mesen: { engineId: "mesen", displayName: "Mesen 2" },
  melonds: { engineId: "melonds", displayName: "MelonDS" },
  azahar: { engineId: "azahar", displayName: "Azahar" },
  dolphin: { engineId: "dolphin", displayName: "Dolphin" },
  ares: { engineId: "ares", displayName: "Ares" },
  duckstation: { engineId: "duckstation", displayName: "DuckStation" },
  pcsx2: { engineId: "pcsx2", displayName: "PCSX2" },
};

export const CONSOLE_CATALOG: Record<ConsoleID, ConsoleCatalogEntry> = {
  nes: {
    consoleId: "nes",
    displayName: "NES",
    engineId: "mesen",
    coverRepos: ["Nintendo_-_Nintendo_Entertainment_System"],
    extensions: [".nes", ".unf"],
    identifiedBy: [".nes", ".unf"],
  },

  snes: {
    consoleId: "snes",
    displayName: "SNES",
    engineId: "mesen",
    coverRepos: ["Nintendo_-_Super_Nintendo_Entertainment_System"],
    extensions: [".sfc", ".smc", ".snes"],
    identifiedBy: [".sfc", ".smc", ".snes"],
    bios: {
      required: false,
      files: [
        { filename: "dsp1.rom", description: "DSP1 firmware", level: "required", gameSpecific: true },
        { filename: "dsp1b.rom", description: "DSP1B firmware", level: "required", gameSpecific: true },
        { filename: "dsp2.rom", description: "DSP2 firmware", level: "required", gameSpecific: true },
        { filename: "dsp3.rom", description: "DSP3 firmware", level: "required", gameSpecific: true },
        { filename: "dsp4.rom", description: "DSP4 firmware", level: "required", gameSpecific: true },
        { filename: "st010.rom", description: "ST010 firmware", level: "required", gameSpecific: true },
        { filename: "st011.rom", description: "ST011 firmware", level: "required", gameSpecific: true },
      ],
    },
  },

  gb: {
    consoleId: "gb",
    displayName: "Game Boy",
    engineId: "mesen",
    coverRepos: ["Nintendo_-_Game_Boy", "Nintendo_-_Game_Boy_Color"],
    extensions: [".gb", ".gbc"],
    identifiedBy: [".gb", ".gbc"],
  },

  gba: {
    consoleId: "gba",
    displayName: "Game Boy Advance",
    engineId: "mesen",
    coverRepos: ["Nintendo_-_Game_Boy_Advance"],
    extensions: [".gba"],
    identifiedBy: [".gba"],
    bios: {
      files: [{ filename: "gba_bios.bin", description: "Game Boy Advance BIOS" }],
    },
  },

  gg: {
    consoleId: "gg",
    displayName: "GameGear",
    engineId: "mesen",
    coverRepos: ["Sega_-_Game_Gear"],
    extensions: [".gg"],
    identifiedBy: [".gg"],
  },

  sms: {
    consoleId: "sms",
    displayName: "Sega Master System",
    engineId: "mesen",
    coverRepos: ["Sega_-_Master_System_-_Mark_III"],
    extensions: [".sms"],
    identifiedBy: [".sms"],
  },

  pce: {
    consoleId: "pce",
    displayName: "PC Engine",
    engineId: "mesen",
    coverRepos: ["NEC_-_PC_Engine_-_TurboGrafx_16"],
    extensions: [".pce", ".sgx"],
    identifiedBy: [".pce", ".sgx"],
  },

  n64: {
    consoleId: "n64",
    displayName: "N64",
    engineId: "ares",
    coverRepos: ["Nintendo_-_Nintendo_64"],
    extensions: [".n64", ".z64", ".v64"],
    identifiedBy: [".n64", ".z64", ".v64"],
  },

  ds: {
    consoleId: "ds",
    displayName: "DS",
    engineId: "melonds",
    coverRepos: ["Nintendo_-_Nintendo_DS"],
    // `.zip` is accepted but never identifying: archives are inspected by entry.
    extensions: [".nds", ".zip"],
    identifiedBy: [".nds"],
    bios: {
      files: [
        { filename: "bios7.bin", description: "ARM7 BIOS" },
        { filename: "bios9.bin", description: "ARM9 BIOS" },
        { filename: "firmware.bin", description: "Firmware" },
      ],
    },
  },

  "3ds": {
    consoleId: "3ds",
    displayName: "3DS",
    engineId: "azahar",
    coverRepos: ["Nintendo_-_Nintendo_3DS"],
    extensions: [".3ds", ".cia", ".cxi"],
    identifiedBy: [".3ds", ".cia", ".cxi"],
    bios: {
      required: false,
      label: "Azahar system data (optional: Miis, fonts)",
      files: [
        {
          filename: "user",
          description: "Azahar user folder (contains nand/sysdata/sdmc)",
          level: "warning",
        },
      ],
    },
  },

  gc: {
    consoleId: "gc",
    displayName: "GameCube",
    engineId: "dolphin",
    coverRepos: ["Nintendo_-_GameCube"],
    extensions: [".iso", ".gcm", ".rvz", ".ciso"],
    signature: { offset: 0x1c, bytes: [0xc2, 0x33, 0x9f, 0x3d] },
  },

  wii: {
    consoleId: "wii",
    displayName: "Wii",
    engineId: "dolphin",
    coverRepos: ["Nintendo_-_Wii"],
    extensions: [".iso", ".wbfs", ".rvz"],
    signature: { offset: 0x18, bytes: [0x5d, 0x1c, 0x9e, 0xa3] },
  },

  ps1: {
    consoleId: "ps1",
    displayName: "PS1",
    engineId: "duckstation",
    coverRepos: ["Sony_-_PlayStation"],
    extensions: [".bin", ".cue", ".iso", ".chd", ".img", ".pbp"],
    bios: {
      required: true,
      onlyNeedOne: true,
      label: "PS1 BIOS (required for emulation)",
      files: [
        { filename: "scph1001.bin", description: "PS1 BIOS (USA)", level: "required" },
        { filename: "scph5500.bin", description: "PS1 BIOS (Japan)", level: "warning" },
        { filename: "scph5501.bin", description: "PS1 BIOS (USA v3.0)", level: "warning" },
        { filename: "scph5502.bin", description: "PS1 BIOS (Europe)", level: "warning" },
        { filename: "scph7502.bin", description: "PS1 BIOS (Europe v4.1)", level: "warning" },
        { filename: "ps1_bios.bin", description: "PS1 BIOS (generic)", level: "warning" },
      ],
    },
  },

  ps2: {
    consoleId: "ps2",
    displayName: "PS2",
    engineId: "pcsx2",
    coverRepos: ["Sony_-_PlayStation_2"],
    extensions: [".iso", ".bin", ".chd"],
    bios: {
      required: true,
      onlyNeedOne: true,
      label: "PS2 BIOS (required for emulation)",
      files: [
        { filename: "scph10000.bin", description: "PS2 BIOS (Japan v1.0)", level: "warning" },
        { filename: "scph30001.bin", description: "PS2 BIOS (USA v1.2)", level: "warning" },
        { filename: "scph30004.bin", description: "PS2 BIOS (Europe v1.2)", level: "warning" },
        { filename: "scph39001.bin", description: "PS2 BIOS (USA v1.6)", level: "warning" },
        { filename: "scph39004.bin", description: "PS2 BIOS (Europe v1.6)", level: "warning" },
        { filename: "scph70012.bin", description: "PS2 BIOS (USA v2.0)", level: "warning" },
        { filename: "scph77001.bin", description: "PS2 BIOS (USA v2.2)", level: "warning" },
        { filename: "bios.bin", description: "PS2 BIOS (generic)", level: "warning" },
        { filename: "ps2_bios.bin", description: "PS2 BIOS (generic)", level: "warning" },
      ],
    },
  },
};

export const CONSOLE_IDS = Object.keys(CONSOLE_CATALOG) as ConsoleID[];
export const ENGINE_IDS = Object.keys(ENGINE_CATALOG) as EngineID[];
