import type { ConsoleID } from '../types';

export const EXTENSION_MAP: Record<string, ConsoleID> = {
  '.nes': 'nes',
  '.unf': 'nes',
};

export const ACCEPTED_EXTENSIONS = [
  '.nes',
  '.unf',
  '.zip',
].join(',');