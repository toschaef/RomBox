import path from "path";
import type { ConsoleDefinition } from "../../shared/types/engines";
import type { ConsoleID } from "../../shared/types";
import {
  CONSOLE_CATALOG,
  CONSOLE_IDS,
  type RomSignature,
} from "../../shared/emulators/catalog";
import { osHandler } from "../platform";

/** Matches a fixed byte sequence at a fixed offset. */
const fromSignature = (sig: RomSignature) => (buffer: Buffer): boolean => {
  if (buffer.length < sig.offset + sig.bytes.length) return false;
  return sig.bytes.every((byte, i) => buffer[sig.offset + i] === byte);
};

// consoles omitted here are identified by extension alone
const DETECTORS: Partial<Record<ConsoleID, (buffer: Buffer) => boolean>> = {
  nes: (buffer) =>
    buffer.length > 4 &&
    buffer[0] === 0x4e &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x53 &&
    buffer[3] === 0x1a,

  n64: (buffer) => {
    if (buffer.length < 4) return false;
    const magic = buffer.readUInt32BE(0);
    return [0x80371240, 0x37804012, 0x40123780].includes(magic);
  },

  ps1: (buffer) => {
    if (buffer.length < 0x8013) return false;
    return buffer.slice(0x8008, 0x8013).toString("ascii") === "PLAYSTATION";
  },

  ps2: (buffer) => {
    if (buffer.length < 0x8010) return false;
    return buffer.slice(0x8008, 0x8013).toString("ascii") === "PLAYSTATION";
  },
};

/**
 * Where each console's BIOS files live on disk
 */
const BIOS_INSTALL_DIRS: Partial<Record<ConsoleID, () => string>> = {
  snes: () => path.join(osHandler.getEmulatorBasePath("mesen"), "Firmware"),
  gba: () => path.join(osHandler.getEmulatorBasePath("mesen"), "Firmware"),
  ds: () => osHandler.getEmulatorBasePath("melonds"),
  "3ds": () => osHandler.getEmulatorBasePath("azahar"),
  ps1: () => path.join(osHandler.getEmulatorBasePath("duckstation"), "bios"),
  ps2: () => path.join(osHandler.getEmulatorBasePath("pcsx2"), "bios"),
};

function buildConsole(consoleId: ConsoleID): ConsoleDefinition {
  const entry = CONSOLE_CATALOG[consoleId];
  const detect =
    DETECTORS[consoleId] ??
    (entry.signature ? fromSignature(entry.signature) : () => false);

  const definition: ConsoleDefinition = {
    consoleId,
    acceptedExtensions: entry.extensions,
    detect,
  };

  if (entry.bios) {
    const resolveBiosDir = BIOS_INSTALL_DIRS[consoleId];
    definition.bios = {
      files: entry.bios.files,
      required: entry.bios.required,
      onlyNeedOne: entry.bios.onlyNeedOne,
      label: entry.bios.label,
      // resolved on access, not at module load: osHandler is assigned while
      // the platform module is still initializing, and reading it here would
      // both crash on an unsupported OS and make this module's import order
      // load-bearing.
      get installDir() {
        return resolveBiosDir?.();
      },
    };
  }

  return definition;
}

export const CONSOLES: Record<ConsoleID, ConsoleDefinition> = Object.fromEntries(
  CONSOLE_IDS.map((id) => [id, buildConsole(id)])
) as Record<ConsoleID, ConsoleDefinition>;
