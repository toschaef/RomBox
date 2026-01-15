import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { Game, ConsoleID } from '../../shared/types';
import { Logger } from '../utils/logger';
import { Downloader } from '../utils/downloader';

const log = Logger.create('CoverService');

const LIBRETRO_REPOS: Record<ConsoleID, string> = {
  nes: 'Nintendo_-_Nintendo_Entertainment_System',
  snes: 'Nintendo_-_Super_Nintendo_Entertainment_System',
  gb: 'Nintendo_-_Game_Boy',
  gba: 'Nintendo_-_Game_Boy_Advance',
  gg: 'Sega_-_Game_Gear',
  sms: 'Sega_-_Master_System_-_Mark_III',
  pce: 'NEC_-_PC_Engine_-_TurboGrafx_16',
  n64: 'Nintendo_-_Nintendo_64',
  ds: 'Nintendo_-_Nintendo_DS',
  '3ds': 'Nintendo_-_Nintendo_3DS',
  gc: 'Nintendo_-_GameCube',
  wii: 'Nintendo_-_Wii',
  ps1: 'Sony_-_PlayStation',
  ps2: 'Sony_-_PlayStation_2',
};

const FAILED_CACHE_FILE = path.join(app.getPath('userData'), 'failed-covers.json');
let failedCovers: Set<string> = new Set();

try {
  if (fs.existsSync(FAILED_CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(FAILED_CACHE_FILE, 'utf-8'));
    if (Array.isArray(data)) {
      failedCovers = new Set(data);
    }
  }
} catch (e) {
  log.warn('Failed to load negative cover cache', e);
}

function saveNegativeCache() {
  try {
    fs.writeFileSync(FAILED_CACHE_FILE, JSON.stringify(Array.from(failedCovers)));
  } catch (e) {
    log.error('Failed to save negative cover cache', e);
  }
}

const INVALID_FILENAME_CHARS = /[&*/:`<>?\\|"]/g;

function normalizeTitle(title: string): string {
  let normalized = title;

  normalized = normalized.replace(/\.(nes|snes|sfc|smc|gb|gbc|gba|n64|z64|v64|nds|3ds|cia|iso|bin|cue|chd|gcm|wbfs|rvz|ciso|pbp|img|gg|sms|pce)$/i, '');

  normalized = normalized.replace(INVALID_FILENAME_CHARS, '_');

  normalized = normalized.trim();

  return normalized;
}

function buildCoverUrl(consoleId: ConsoleID, title: string): string | null {
  const repo = LIBRETRO_REPOS[consoleId];
  if (!repo) {
    log.warn('No Libretro repo mapping for console', { consoleId });
    return null;
  }

  const normalizedTitle = normalizeTitle(title);
  const encodedTitle = encodeURIComponent(normalizedTitle);

  return `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/Named_Boxarts/${encodedTitle}.png`;
}

function getCoverCachePath(game: Game): string {
  const coversDir = path.join(app.getPath('userData'), 'covers', game.consoleId);
  const sanitizedTitle = normalizeTitle(game.title).replace(/[/\\]/g, '_');
  return path.join(coversDir, `${sanitizedTitle}.png`);
}

async function downloadCover(url: string, destPath: string): Promise<boolean> {
  const destDir = path.dirname(destPath);
  try {
    await Downloader.download(url, destDir);
    const downloadedPath = path.join(destDir, path.basename(url.split('?')[0]));
    if (downloadedPath !== destPath && fs.existsSync(downloadedPath)) {
      fs.renameSync(downloadedPath, destPath);
    }
    return fs.existsSync(destPath);
  } catch (err: any) {
    log.debug('Cover download failed', { url, error: err.message });
    return false;
  }
}

export const CoverService = {
  hasCover(game: Game): boolean {
    const coverPath = getCoverCachePath(game);
    return fs.existsSync(coverPath);
  },

  getCoverPath(game: Game): string {
    return getCoverCachePath(game);
  },

  async fetchCover(game: Game): Promise<string | null> {
    const coverPath = getCoverCachePath(game);

    if (fs.existsSync(coverPath)) {
      log.debug('Cover already cached', { gameId: game.id, path: coverPath });
      return coverPath;
    }

    if (failedCovers.has(game.id)) {
      log.debug('Cover pending or failed previously', { gameId: game.id });
      return null;
    }

    const url = buildCoverUrl(game.consoleId, game.title);
    if (!url) {
      return null;
    }

    log.info('Fetching cover', { gameId: game.id, title: game.title, url });

    const success = await downloadCover(url, coverPath);

    if (success) {
      log.info('Cover downloaded successfully', { gameId: game.id, path: coverPath });
      return coverPath;
    }

    const alternativeNames = generateAlternativeNames(game.title);
    for (const altName of alternativeNames) {
      const altUrl = buildCoverUrl(game.consoleId, altName);
      if (altUrl && altUrl !== url) {
        log.debug('Trying alternative name', { altName, url: altUrl });
        const altSuccess = await downloadCover(altUrl, coverPath);
        if (altSuccess) {
          log.info('Cover found with alternative name', { gameId: game.id, altName });
          return coverPath;
        }
      }
    }

    log.debug('No cover found', { gameId: game.id, title: game.title });
    failedCovers.add(game.id);
    saveNegativeCache();
    return null;
  },

  async getCover(game: Game): Promise<string | null> {
    if (this.hasCover(game)) {
      return this.getCoverPath(game);
    }
    return this.fetchCover(game);
  },
};

function generateAlternativeNames(title: string): string[] {
  const alternatives: string[] = [];
  let base = title;

  base = base.replace(/\.(nes|snes|sfc|smc|gb|gbc|gba|n64|z64|v64|nds|3ds|cia|iso|bin|cue|chd|gcm|wbfs|rvz|ciso|pbp|img|gg|sms|pce)$/i, '');

  const cleanBase = base
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s*\[[^\]]*\]\s*/g, '')
    .trim();

  if (cleanBase !== base) {
    alternatives.push(cleanBase);
  }

  const regionSuffixes = [
    '(USA)',
    '(Europe)',
    '(Japan)',
    '(World)',
    '(USA, Europe)',
    '(Japan, USA)',
    '(Europe) (En,Fr,De)',
    '(Europe) (En,Fr,De,Es,It)',
    '(USA) (En,Fr)',
    '(USA) (En,Fr,De)',
    '(USA) (En,Fr,Es)',
  ];

  for (const suffix of regionSuffixes) {
    const withRegion = `${cleanBase} ${suffix}`;
    if (withRegion !== base && !alternatives.includes(withRegion)) {
      alternatives.push(withRegion);
    }
  }

  if (cleanBase.toLowerCase().startsWith('the ')) {
    const withoutThe = cleanBase.substring(4);
    for (const suffix of regionSuffixes.slice(0, 4)) {
      alternatives.push(`${withoutThe} ${suffix}`);
    }
  }

  return alternatives;
}
