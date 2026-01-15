import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { Game, ConsoleID } from '../../shared/types';
import { Logger } from '../utils/logger';
import { Downloader } from '../utils/downloader';

const log = Logger.create('CoverService');

/**
 * Mapping of ConsoleID to Libretro Thumbnails repository names
 * @see https://github.com/libretro-thumbnails
 */
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

/**
 * Characters that are invalid in Libretro thumbnail filenames
 * These get replaced with underscores in their naming convention
 */
const INVALID_FILENAME_CHARS = /[&*/:`<>?\\|"]/g;

/**
 * Normalize a game title to match Libretro's naming convention
 */
function normalizeTitle(title: string): string {
  let normalized = title;

  // Remove common file extensions
  normalized = normalized.replace(/\.(nes|snes|sfc|smc|gb|gbc|gba|n64|z64|v64|nds|3ds|cia|iso|bin|cue|chd|gcm|wbfs|rvz|ciso|pbp|img|gg|sms|pce)$/i, '');

  // Replace invalid filename characters with underscores
  normalized = normalized.replace(INVALID_FILENAME_CHARS, '_');

  // Trim whitespace
  normalized = normalized.trim();

  return normalized;
}

/**
 * Build the cover URL for a game
 */
function buildCoverUrl(consoleId: ConsoleID, title: string): string | null {
  const repo = LIBRETRO_REPOS[consoleId];
  if (!repo) {
    log.warn('No Libretro repo mapping for console', { consoleId });
    return null;
  }

  const normalizedTitle = normalizeTitle(title);
  // URL encode the title (spaces become %20, etc.)
  const encodedTitle = encodeURIComponent(normalizedTitle);

  return `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/Named_Boxarts/${encodedTitle}.png`;
}

/**
 * Get the local cache path for a game's cover
 */
function getCoverCachePath(game: Game): string {
  const coversDir = path.join(app.getPath('userData'), 'covers', game.consoleId);
  const sanitizedTitle = normalizeTitle(game.title).replace(/[/\\]/g, '_');
  return path.join(coversDir, `${sanitizedTitle}.png`);
}

/**
 * Download a cover from URL to destination path using Downloader utility
 * Returns true if successful, false otherwise
 */
async function downloadCover(url: string, destPath: string): Promise<boolean> {
  const destDir = path.dirname(destPath);
  try {
    await Downloader.download(url, destDir);
    // Downloader uses the filename from URL, we may need to rename
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
  /**
   * Check if a cover exists locally for a game
   */
  hasCover(game: Game): boolean {
    const coverPath = getCoverCachePath(game);
    return fs.existsSync(coverPath);
  },

  /**
   * Get the local cover path for a game (may not exist)
   */
  getCoverPath(game: Game): string {
    return getCoverCachePath(game);
  },

  /**
   * Fetch and cache a cover for a game
   * Returns the local path if successful, null otherwise
   */
  async fetchCover(game: Game): Promise<string | null> {
    const coverPath = getCoverCachePath(game);

    // Check if already cached
    if (fs.existsSync(coverPath)) {
      log.debug('Cover already cached', { gameId: game.id, path: coverPath });
      return coverPath;
    }

    if (failedCovers.has(game.id)) {
      log.debug('Cover pending or failed previously', { gameId: game.id });
      return null;
    }

    // Build the URL
    const url = buildCoverUrl(game.consoleId, game.title);
    if (!url) {
      return null;
    }

    log.info('Fetching cover', { gameId: game.id, title: game.title, url });

    // Download the cover
    const success = await downloadCover(url, coverPath);

    if (success) {
      log.info('Cover downloaded successfully', { gameId: game.id, path: coverPath });
      return coverPath;
    }

    // Try alternative name formats if initial attempt fails
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

  /**
   * Get cover for a game, fetching if necessary
   */
  async getCover(game: Game): Promise<string | null> {
    if (this.hasCover(game)) {
      return this.getCoverPath(game);
    }
    return this.fetchCover(game);
  },
};

/**
 * Generate alternative title names to try if the primary doesn't match.
 * Libretro uses No-Intro naming which includes region tags like (USA), (Europe), etc.
 */
function generateAlternativeNames(title: string): string[] {
  const alternatives: string[] = [];
  let base = title;

  // Remove file extension if present
  base = base.replace(/\.(nes|snes|sfc|smc|gb|gbc|gba|n64|z64|v64|nds|3ds|cia|iso|bin|cue|chd|gcm|wbfs|rvz|ciso|pbp|img|gg|sms|pce)$/i, '');

  // Remove any existing region/version tags and brackets to get clean title
  const cleanBase = base
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s*\[[^\]]*\]\s*/g, '')
    .trim();

  // If title already has region tags, also try the clean version
  if (cleanBase !== base) {
    alternatives.push(cleanBase);
  }

  // PRIORITY: Try with common region suffixes (No-Intro style naming)
  // Most games will be (USA), (Europe), (Japan), or (World)
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
