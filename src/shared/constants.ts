import type { ConsoleID } from "./types"
import type { EngineID } from "./types/engines";

export const IS_MAC = typeof process !== 'undefined' && process.platform 
  ? process.platform === 'darwin' 
  : typeof navigator !== 'undefined' 
    ? navigator.platform.toUpperCase().indexOf('MAC') >= 0 
    : false;

export const CONSOLEID_ENGLISH_MAP: Record<ConsoleID, string> = {
  'nes': 'NES',
  'gg': 'GameGear',
  'sms': 'Sega Master System',
  'pce': 'PC Engine',
  'snes': 'SNES',
  'gb': 'Game Boy',
  'gba': 'Game Boy Advance',
  'n64': 'N64',
  'ds': 'DS',
  '3ds': '3DS',
  'gc': 'GameCube',
  'wii': 'Wii',
}

export const getConsoleNameFromId = (id: ConsoleID) => CONSOLEID_ENGLISH_MAP[id];

export const CONSOLEID_ENGINEID_MAP: Record<ConsoleID, EngineID> = {
  'nes': 'mesen',
  'gg': 'mesen',
  'sms': 'mesen',
  'pce': 'mesen',
  'snes': 'mesen',
  'gb': 'mesen',
  'gba': 'mesen',
  'n64': IS_MAC? 'ares' : 'rmg',
  'ds': 'melonds',
  '3ds': 'azahar',
  'gc': 'dolphin',
  'wii': 'dolphin',
}

export const getEngineIdFromConsoleId = (id: ConsoleID) => CONSOLEID_ENGINEID_MAP[id];

export const ENGINEID_CONSOLEID_MAP: Record<EngineID, ConsoleID> = {
  'mesen' : 'nes',
  'ares': 'n64',
  'rmg': 'n64',
  'melonds': 'ds',
  'azahar': '3ds',
  'dolphin': 'gc',
}
export const getConsoleIdFromEngineId = (id: EngineID) => ENGINEID_CONSOLEID_MAP[id];


export const EXTENSION_MAP: Record<string, ConsoleID> = {
  '.nes': 'nes',
  '.unf': 'nes',

  '.gg': 'gg',
  '.sms': 'sms',

  '.pce': 'pce',
  '.sgx': 'pce',

  '.sfc': 'snes',
  '.smc': 'snes',
  '.snes': 'snes',

  '.gb': 'gb',
  '.gbc': 'gb',

  '.n64': 'n64',
  '.z64': 'n64',
  '.v64': 'n64',

  '.gba': 'gba',

  '.nds': 'ds',

  '.3ds': '3ds',
  '.cia': '3ds',
  '.cxi': '3ds',
};

export const ACCEPTED_EXTENSIONS = [
  ...Object.keys(EXTENSION_MAP),
  '.zip',
  '.7z',
  '.iso',
  '.rvz'
].join(',');

export const isAmbiguousExtension = (ext: string) => {
  return ['.iso', '.rvz'].includes(ext.toLowerCase());
}

export function getConsoleIdFromExtension(extension: string) {
  if (isAmbiguousExtension(extension)) return null;
  return EXTENSION_MAP[extension.toLowerCase()];
}

export const BIOS_FILENAMES: Record<string, ConsoleID> = {
  'gba_bios.bin': 'gba',

  'bios7.bin': 'ds',
  'bios9.bin': 'ds',
  'firmware.bin': 'ds',
};

export const getBiosConsole = (filename: string): ConsoleID | undefined => {
  return BIOS_FILENAMES[filename.toLowerCase()];
};

export const ENGINE_MAP: Record<ConsoleID, string> = {
  'nes': 'Mesen',
  'snes': 'Mesen',
  'gb': 'Mesen',
  'gba': 'Mesen',
  'pce': 'Mesen',
  'sms': 'Mesen',
  'gg': 'Mesen',

  'n64': IS_MAC? 'ARES' : 'RMG',
  'ds': 'MelonDS',
  '3ds': 'Azahar',

  'gc': 'Dolphin',
  'wii': 'Dolphin',
};

interface Signature {
  id: ConsoleID;
  offset: number;
  bytes: number[];
}

// signatures for scanning ISO's
export const SIGNATURES: Signature[] = [
  {
    id: 'gc',
    offset: 0x1C,
    bytes: [0xC2, 0x33, 0x9F, 0x3D] 
  },
  {
    id: 'wii',
    offset: 0x18,
    bytes: [0x5D, 0x1C, 0x9E, 0xA3]
  }
];