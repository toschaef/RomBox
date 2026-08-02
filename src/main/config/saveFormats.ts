export type SaveFormatID =
  | "battery-raw"
  | "rtc-companion"
  | "mesen-savestate"
  | "n64-eeprom"
  | "n64-sram"
  | "n64-flash"
  | "n64-controller-pak"
  | "ds-battery"
  | "ds-dsv"
  | "gc-gci"
  | "gc-memcard-raw"
  | "gc-sram"
  | "ps1-memcard"
  | "duckstation-savestate"
  | "ps2-memcard"
  | "pcsx2-savestate";

export interface SaveFormat {
  id: SaveFormatID;
  /** shown to the user when an import is rejected */
  label: string;
  /** lowercase extensions this format claims */
  extensions: string[];
  /**
   * returns null when the buffer is a valid file of this format, otherwise a
   * short reason it is not.
   */
  validate: (buffer: Buffer) => string | null;
  /**
   * companion formats carry no identifying structure of their own (a real
   * time clock dump is a handful of raw bytes) and are only accepted next to
   * a primary save that validated.
   */
  companion?: boolean;
}

const KIB = 1024;
const MIB = 1024 * 1024;

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function readAscii(buffer: Buffer, offset: number, length: number): string {
  return buffer.subarray(offset, offset + length).toString("latin1");
}

function describeSize(bytes: number): string {
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(bytes % MIB === 0 ? 0 : 2)} MB`;
  if (bytes >= KIB) return `${(bytes / KIB).toFixed(bytes % KIB === 0 ? 0 : 2)} KB`;
  return `${bytes} bytes`;
}

function requireMagic(buffer: Buffer, magic: string, offset = 0): string | null {
  if (buffer.length < offset + magic.length) return "file is too small to contain a header";
  if (readAscii(buffer, offset, magic.length) !== magic) {
    return `missing "${magic}" signature`;
  }
  return null;
}

function requireExactSize(buffer: Buffer, sizes: number[]): string | null {
  if (sizes.includes(buffer.length)) return null;
  const expected = sizes.map(describeSize).join(" or ");
  return `size is ${describeSize(buffer.length)}, expected ${expected}`;
}

function requirePowerOfTwoSize(buffer: Buffer, min: number, max: number): string | null {
  if (buffer.length < min || buffer.length > max) {
    return `size is ${describeSize(buffer.length)}, expected between ${describeSize(min)} and ${describeSize(max)}`;
  }
  if (!isPowerOfTwo(buffer.length)) {
    return `size is ${describeSize(buffer.length)}, which is not a valid save chip size`;
  }
  return null;
}

function validatePs1Frames(buffer: Buffer): string | null {
  const FRAME = 128;
  const HEADER_FRAMES = 16;

  for (let frame = 0; frame < HEADER_FRAMES; frame++) {
    const start = frame * FRAME;
    let checksum = 0;
    for (let i = start; i < start + FRAME - 1; i++) checksum ^= buffer[i];

    if (checksum !== buffer[start + FRAME - 1]) {
      return `directory frame ${frame} fails its checksum, the card is corrupt`;
    }
  }

  return null;
}

function validateGci(buffer: Buffer): string | null {
  const HEADER = 0x40;
  const BLOCK = 8 * KIB;
  const BLOCK_COUNT_OFFSET = 0x38;

  if (buffer.length < HEADER + BLOCK) {
    return `size is ${describeSize(buffer.length)}, too small for a header and one block`;
  }

  const payload = buffer.length - HEADER;
  if (payload % BLOCK !== 0) {
    return `size is ${describeSize(buffer.length)}, which is not a header plus whole 8 KB blocks`;
  }

  const declaredBlocks = buffer.readUInt16BE(BLOCK_COUNT_OFFSET);
  const actualBlocks = payload / BLOCK;
  if (declaredBlocks !== actualBlocks) {
    return `header declares ${declaredBlocks} block(s) but the file holds ${actualBlocks}`;
  }

  const gameCode = readAscii(buffer, 0, 4);
  const makerCode = readAscii(buffer, 4, 2);
  if (!/^[0-9A-Z]{4}$/.test(gameCode) || !/^[0-9A-Z]{2}$/.test(makerCode)) {
    return "header does not start with a GameCube game and maker code";
  }

  return null;
}

export const SAVE_FORMATS: Record<SaveFormatID, SaveFormat> = {
  "battery-raw": {
    id: "battery-raw",
    label: "cartridge save",
    extensions: [".srm", ".sav", ".sram"],
    validate: (buffer) => requirePowerOfTwoSize(buffer, 512, 1 * MIB),
  },

  "rtc-companion": {
    id: "rtc-companion",
    label: "real-time clock data",
    extensions: [".rtc"],
    companion: true,
    validate: (buffer) =>
      buffer.length > 0 && buffer.length <= 4 * KIB
        ? null
        : `size is ${describeSize(buffer.length)}, expected a small clock dump`,
  },

  "mesen-savestate": {
    id: "mesen-savestate",
    label: "Mesen save state",
    extensions: [".mss"],
    validate: (buffer) => requireMagic(buffer, "MSS"),
  },

  "n64-eeprom": {
    id: "n64-eeprom",
    label: "N64 EEPROM save",
    extensions: [".eeprom"],
    validate: (buffer) => requireExactSize(buffer, [512, 2 * KIB]),
  },

  "n64-sram": {
    id: "n64-sram",
    label: "N64 SRAM save",
    extensions: [".sram"],
    validate: (buffer) => requireExactSize(buffer, [32 * KIB]),
  },

  "n64-flash": {
    id: "n64-flash",
    label: "N64 FlashRAM save",
    extensions: [".flash"],
    validate: (buffer) => requireExactSize(buffer, [128 * KIB]),
  },

  "n64-controller-pak": {
    id: "n64-controller-pak",
    label: "N64 Controller Pak",
    extensions: [".pak"],
    validate: (buffer) => requireExactSize(buffer, [32 * KIB]),
  },

  "ds-battery": {
    id: "ds-battery",
    label: "DS cartridge save",
    extensions: [".sav"],
    validate: (buffer) => requirePowerOfTwoSize(buffer, 512, 8 * MIB),
  },

  "ds-dsv": {
    id: "ds-dsv",
    label: "DeSmuME save",
    extensions: [".dsv"],
    validate: (buffer) => {
      const FOOTER = "|-DESMUME SAVE-|";
      if (buffer.length <= FOOTER.length) return "file is too small to contain a DeSmuME footer";
      const tail = readAscii(buffer, buffer.length - FOOTER.length, FOOTER.length);
      return tail === FOOTER ? null : "missing the DeSmuME save footer";
    },
  },

  "gc-gci": {
    id: "gc-gci",
    label: "GameCube memory card file",
    extensions: [".gci"],
    validate: validateGci,
  },

  "gc-memcard-raw": {
    id: "gc-memcard-raw",
    label: "GameCube memory card image",
    extensions: [".raw"],
    validate: (buffer) =>
      requireExactSize(buffer, [512 * KIB, 1 * MIB, 2 * MIB, 4 * MIB, 8 * MIB, 16 * MIB]),
  },

  "gc-sram": {
    id: "gc-sram",
    label: "GameCube system SRAM",
    extensions: [".raw"],
    validate: (buffer) => requireExactSize(buffer, [68]) ?? requireMagic(buffer, "DOLPHINS", 0x18),
  },

  "ps1-memcard": {
    id: "ps1-memcard",
    label: "PS1 memory card",
    extensions: [".mcd", ".mcr"],
    validate: (buffer) =>
      requireExactSize(buffer, [128 * KIB]) ?? requireMagic(buffer, "MC") ?? validatePs1Frames(buffer),
  },

  "duckstation-savestate": {
    id: "duckstation-savestate",
    label: "DuckStation save state",
    extensions: [".sav"],
    validate: (buffer) => requireMagic(buffer, "DUCCS"),
  },

  "ps2-memcard": {
    id: "ps2-memcard",
    label: "PS2 memory card",
    extensions: [".ps2"],
    validate: (buffer) =>
      requireMagic(buffer, "Sony PS2 Memory Card Format ") ??
      requireExactSize(buffer, [8, 16, 32, 64].map((mb) => (mb * MIB * 33) / 32)),
  },

  "pcsx2-savestate": {
    id: "pcsx2-savestate",
    label: "PCSX2 save state",
    extensions: [".p2s"],
    validate: (buffer) => requireMagic(buffer, "PK\x03\x04"),
  },
};

export function getSaveFormat(id: SaveFormatID): SaveFormat {
  return SAVE_FORMATS[id];
}

export function matchFormatByExtension(fileName: string, allowed: SaveFormatID[]): SaveFormat[] {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return allowed.map(getSaveFormat).filter((format) => format.extensions.includes(ext));
}
