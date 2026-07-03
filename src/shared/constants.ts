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
  'ps1': 'PS1',
  'ps2': 'PS2',
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
  'n64': IS_MAC ? 'ares' : 'rmg',
  'ds': 'melonds',
  '3ds': 'azahar',
  'gc': 'dolphin',
  'wii': 'dolphin',
  'ps1': 'duckstation',
  'ps2': 'pcsx2',
}

export const getEngineIdFromConsoleId = (id: ConsoleID) => CONSOLEID_ENGINEID_MAP[id];

export const ENGINEID_CONSOLEID_MAP: Record<EngineID, ConsoleID> = {
  'mesen': 'nes',
  'ares': 'n64',
  'rmg': 'n64',
  'melonds': 'ds',
  'azahar': '3ds',
  'dolphin': 'gc',
  'duckstation': 'ps1',
  'pcsx2': 'ps2',
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
  return ['.iso', '.rvz', '.bin', '.chd'].includes(ext.toLowerCase());
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

  'scph1001.bin': 'ps1',
  'scph5500.bin': 'ps1',
  'scph5501.bin': 'ps1',
  'scph5502.bin': 'ps1',
  'scph7502.bin': 'ps1',
  'ps1_bios.bin': 'ps1',

  'scph10000.bin': 'ps2',
  'scph39001.bin': 'ps2',
  'scph70012.bin': 'ps2',
  'scph77001.bin': 'ps2',
  'scph39004.bin': 'ps2',
  'ps2_bios.bin': 'ps2',
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

  'n64': IS_MAC ? 'ARES' : 'RMG',
  'ds': 'MelonDS',
  '3ds': 'Azahar',

  'gc': 'Dolphin',
  'wii': 'Dolphin',

  'ps1': 'DuckStation',
  'ps2': 'PCSX2',
};

export const getEmulatorNameFromConsoleID = (consoleID: ConsoleID): string => {
  return ENGINE_MAP[consoleID];
};

export const getEmulatorNameFromEngineId = (engineId: EngineID): string => {
  return ENGINE_MAP[ENGINEID_CONSOLEID_MAP[engineId]];
};

interface Signature {
  id: ConsoleID;
  offset: number;
  bytes: number[];
}

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
  },
  {
    id: 'ps2',
    offset: 0x8008,
    bytes: [0x50, 0x4C, 0x41, 0x59, 0x53, 0x54, 0x41, 0x54, 0x49, 0x4F, 0x4E]
  }
];

export const NOTIFICATION_MESSAGES = {  
  // games
  GAME_INSTALLED: (title: string) => `${title} installed`,
  LAUNCH_FAILED: (gameTitle: string) => `Error launching ${gameTitle}`,
  GAME_DELETED: (gameTitle: string) => `${gameTitle} deleted`,
  DELETE_FAILED: (gameTitle: string) => `Error deleting ${gameTitle}`,
  SAVE_EXPORTED: (gameTitle: string) => `${gameTitle} save data exported`,
  SAVE_EXPORT_FAILED: (gameTitle: string) => `Error exporting ${gameTitle} save data`,
  RENAME_FAILED: (gameTitle: string) => `Error renaming ${gameTitle}`,

  // bios
  BIOS_INSTALLED: (label: string) => `${label} installed`,
  BIOS_REMOVED: (fileName: string) => `${fileName} uninstalled`,

  // engines
  INSTALL_SUCCESS: (emulatorName: string) => `${emulatorName} installed`,
  INSTALL_FAILED: (emulatorName: string, error: string) => `Error installing ${emulatorName}: ${error}`,
  EMULATOR_INSTALLING: (emulatorName: string) => `Error: ${emulatorName} still installing`,
  ENGINE_INSTALLED: (displayName: string) => `${displayName} installed`,
  ENGINE_UNINSTALLED: (displayName: string) => `${displayName} uninstalled`,
  ENGINE_REPAIRED: (displayName: string) => `${displayName} repaired`,

  // useNotifications
  ITEM_SUCCEEDED: (label: string) => `${label} succeeded`,
  ITEM_FAILED: (label: string) => `${label} failed`,
  ITEMS_PROCESSED: (count: number) => `${count} items processed`,
  ITEMS_FAILED: (count: number) => `${count} items failed`,
  BULK_SUCCEEDED: (count: number) => `${count} succeeded`,
  BULK_FAILED: (count: number) => `${count} failed`,
  GAMES_AND_BIOS_INSTALLED: (parts: string) => `${parts} installed`,
  FILES_FAILED: (count: number) => `Error installing${count} file${count > 1 ? 's' : ''}`,

  ERROR_MESSAGE: (message: string) => message,
};