import type { ConsoleID } from '../types';

export const CONSOLEID_ENGLISH_MAP: Record<ConsoleID, string> = {
  'nes': 'NES',
  'snes': 'SNES',
  'gb': 'Game Boy',
  'gba': 'Game Boy Advance',
  'ds': 'DS',
  '3ds': '3DS',
}

export const getConsoleNameFromId = (id: ConsoleID) => CONSOLEID_ENGLISH_MAP[id];

export const EXTENSION_MAP: Record<string, ConsoleID> = {
  '.nes': 'nes',
  '.unf': 'nes',

  '.sfc': 'snes',
  '.smc': 'snes',
  '.snes': 'snes',

  '.gb': 'gb',
  '.gbc': 'gb',

  '.gba': 'gba',

  '.nds': 'ds',

  '.3ds': '3ds',
  '.cia': '3ds',
  '.cxi': '3ds',
};

export const ACCEPTED_EXTENSIONS = [
  ...Object.keys(EXTENSION_MAP),
  '.zip'
].join(',');

export const BIOS_FILENAMES: Record<string, ConsoleID> = {
  'gba_bios.bin': 'gba',

  'bios7.bin': 'ds',
  'bios9.bin': 'ds',
  'firmware.bin': 'ds',
};

export const getBiosConsole = (filename: string): ConsoleID | undefined => {
  return BIOS_FILENAMES[filename.toLowerCase()];
};

export const ENGINE_MAP: Record<string, string> = {
  'nes': 'Mesen',
};