import path from "path";
import { homedir } from "os";
import type { ConsoleDefinition } from "../../shared/types/engines";
import type { ConsoleID } from "../../shared/types";

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
    // bios: {
    //   required: true,
    //   files: [
    //     { filename: "msu1.rom", description: "MSU-1 support", gameSpecific: true },
    //   ],
    // },
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
      installDir: path.join(homedir(), "Library", "Application Support", "Mesen2", "Firmware"),
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
      installDir: path.join(homedir(), "Library", "Preferences", "melonDS"),
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
    // bios: {
    //   required: false,
    //   label: "Firmware / system files",
    //   installDir: path.join(homedir(), "Library", "Application Support", "Azahar", "config"),
    //   files: [
    //     { filename: "aes_keys.txt", description: "AES keys", level: "warning" },
    //     { filename: "seeddb.bin", description: "Seed DB", level: "warning" },
    //   ],
    // },
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
};