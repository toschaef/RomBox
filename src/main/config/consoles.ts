import path from "path";
import type { ConsoleDefinition } from "../../shared/types/engines";
import type { ConsoleID } from "../../shared/types";
import { osHandler } from "../platform";

export const CONSOLES: Record<ConsoleID, ConsoleDefinition> = {
  nes: {
    consoleId: "nes",
    acceptedExtensions: [".nes", ".unf"],
    detect: (buffer) =>
      buffer.length > 4 &&
      buffer[0] === 0x4e &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x53 &&
      buffer[3] === 0x1a,
  },

  snes: {
    consoleId: "snes",
    acceptedExtensions: [".sfc", ".smc", ".snes"],
    detect: () => false,
    bios: {
      required: false,
      installDir: path.join(osHandler.getEmulatorBasePath('mesen'), "Firmware"),
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
    acceptedExtensions: [".gb", ".gbc"],
    detect: () => false,
  },

  gba: {
    consoleId: "gba",
    acceptedExtensions: [".gba"],
    detect: () => false,
    bios: {
      files: [{ filename: "gba_bios.bin", description: "Game Boy Advance BIOS" }],
      installDir: path.join(osHandler.getEmulatorBasePath('mesen'), "Firmware"),
    },
  },

  gg: {
    consoleId: "gg",
    acceptedExtensions: [".gg"],
    detect: () => false,
  },

  sms: {
    consoleId: "sms",
    acceptedExtensions: [".sms"],
    detect: () => false,
  },

  pce: {
    consoleId: "pce",
    acceptedExtensions: [".pce", "xq.sgx"],
    detect: () => false,
  },

  n64: {
    consoleId: "n64",
    acceptedExtensions: [".n64", ".z64", ".v64"],
    detect: (buffer) => {
      if (buffer.length < 4) return false;
      const magic = buffer.readUInt32BE(0);
      return [0x80371240, 0x37804012, 0x40123780].includes(magic);
    },
  },

  ds: {
    consoleId: "ds",
    acceptedExtensions: [".nds", ".zip"],
    detect: () => false,
    bios: {
      installDir: osHandler.getEmulatorBasePath('melonds'),
      files: [
        { filename: "bios7.bin", description: "ARM7 BIOS" },
        { filename: "bios9.bin", description: "ARM9 BIOS" },
        { filename: "firmware.bin", description: "Firmware" },
      ],
    },
  },

  "3ds": {
    consoleId: "3ds",
    acceptedExtensions: [".3ds", ".cia", ".cxi"],
    detect: () => false,
    bios: {
      required: false,
      label: "Azahar system data (optional: Miis, fonts)",
      installDir: osHandler.getEmulatorBasePath('azahar'),
      files: [
        { filename: "user", description: "Azahar user folder (contains nand/sysdata/sdmc)", level: "warning" },
      ],
    },
  },

  gc: {
    consoleId: "gc",
    acceptedExtensions: [".iso", ".gcm", ".rvz", ".ciso"],
    detect: (buffer) => buffer.length >= 0x20 && buffer.readUInt32BE(0x1c) === 0xc2339f3d,
  },

  wii: {
    consoleId: "wii",
    acceptedExtensions: [".iso", ".wbfs", ".rvz"],
    detect: (buffer) => buffer.length >= 0x20 && buffer.readUInt32BE(0x18) === 0x5d1c9ea3,
  },

  ps1: {
    consoleId: "ps1",
    acceptedExtensions: [".bin", ".cue", ".iso", ".chd", ".img", ".pbp"],
    detect: (buffer) => {
      if (buffer.length < 0x8013) return false;
      const marker = buffer.slice(0x8008, 0x8013).toString('ascii');
      return marker === 'PLAYSTATION';
    },
    bios: {
      required: true,
      label: "PS1 BIOS (required for emulation)",
      installDir: path.join(osHandler.getEmulatorBasePath('duckstation'), "bios"),
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
    acceptedExtensions: [".iso", ".bin", ".chd"],
    detect: (buffer) => {
      if (buffer.length < 0x8010) return false;
      const marker = buffer.slice(0x8008, 0x8013).toString('ascii');
      return marker === 'PLAYSTATION';
    },
    bios: {
      required: true,
      label: "PS2 BIOS (required for emulation)",
      installDir: path.join(osHandler.getEmulatorBasePath('pcsx2'), "bios"),
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