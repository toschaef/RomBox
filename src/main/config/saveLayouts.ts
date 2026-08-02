import path from "path";

import type { Game, ConsoleID } from "../../shared/types";
import { osHandler } from "../platform";
import { Logger } from "../utils/logger";
import type { SaveFormatID } from "./saveFormats";

const log = Logger.create("saveLayouts");

export type SaveScope =
  /** files are named after the ROM, so they can be attributed to one game */
  | "per-game"
  /** a container shared by every game of that console */
  | "shared";

export interface SaveRoot {
  /** stable identifier, used in logs and as the prefix in exported archives */
  id: string;
  scope: SaveScope;
  /** directory the emulator writes to */
  dir: string;
  /** where the backup of this root lives inside the save cache */
  cacheDir: string;
  /** lowercase extensions to include; undefined means every file */
  extensions?: string[];
  /** walk subdirectories, preserving their structure through the cache */
  recursive?: boolean;
  /** directory names skipped while walking */
  excludeDirs?: string[];

  importFormats?: SaveFormatID[];

  importPatterns?: RegExp[];

  importFileName?: (ctx: ImportNameContext) => ImportNameResult;
}

export interface ImportNameContext {
  game: Game;
  /** the file name the user picked, without any directory part */
  sourceName: string;
  buffer: Buffer;
}

export type ImportNameResult = { relPath: string } | { rejected: string };

function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

function romBasename(game: Game): string {
  return path.basename(game.filePath, path.extname(game.filePath));
}

function namedAfterRom({ game, sourceName }: ImportNameContext): ImportNameResult {
  return { relPath: `${romBasename(game)}${extensionOf(sourceName)}` };
}

function namedAfterRomWithSlot({ game, sourceName }: ImportNameContext): ImportNameResult {
  const stem = path.basename(sourceName, path.extname(sourceName));
  const slot = /_(\d+)$/.exec(stem)?.[1] ?? "1";
  return { relPath: `${romBasename(game)}_${slot}${extensionOf(sourceName)}` };
}

const GC_REGION_BY_CODE: Record<string, string> = { E: "USA", P: "EUR", J: "JAP" };

function gcMemcardName({ sourceName, buffer }: ImportNameContext): ImportNameResult {
  if (extensionOf(sourceName) === ".gci") {
    const regionCode = buffer.subarray(3, 4).toString("latin1");
    const region = GC_REGION_BY_CODE[regionCode];
    if (!region) {
      return { rejected: `unknown GameCube region code "${regionCode}" in the save's game code` };
    }
    return { relPath: path.join(region, "Card A", sourceName) };
  }

  if (/^MemoryCard[AB]\.(USA|EUR|JAP)\.raw$/.test(sourceName) || sourceName === "SRAM.raw") {
    return { relPath: sourceName };
  }

  return {
    rejected: `raw memory card images must be named MemoryCardA.USA.raw (slot and region), got "${sourceName}"`,
  };
}

function duckStationMemcardName({ game, sourceName }: ImportNameContext): ImportNameResult {
  return { relPath: `${romBasename(game)}_1${extensionOf(sourceName)}` };
}

function pcsx2MemcardName({ sourceName }: ImportNameContext): ImportNameResult {
  if (/^Mcd\d{3}\.(ps2|mcd)$/i.test(sourceName)) return { relPath: sourceName };
  return { relPath: `Mcd001${extensionOf(sourceName)}` };
}

function verbatimName({ sourceName }: ImportNameContext): ImportNameResult {
  return { relPath: sourceName };
}

const MESEN_SAVE_EXTENSIONS = [".sav", ".srm", ".sram", ".rtc", ".eep", ".flash"];

const ARES_SAVE_EXTENSIONS = [
  ".sav", ".srm", ".sram", ".eeprom", ".flash", ".ram", ".pak", ".rtc",
];

const MELONDS_SAVE_EXTENSIONS = [".sav", ".dsv", ".mln", ".rtc"];

const ARES_IMPORT_FORMATS: SaveFormatID[] = [
  "n64-eeprom", "n64-sram", "n64-flash", "n64-controller-pak",
];

function safeBasePath(engineId: Game["engineId"]): string | null {
  try {
    return osHandler.getEmulatorBasePath(engineId);
  } catch (err) {
    log.debug("Emulator base path unavailable", { engineId, error: (err as Error)?.message });
    return null;
  }
}

function safeSavePath(game: Game): string | null {
  try {
    return osHandler.getSavePath(game);
  } catch (err) {
    log.debug("Emulator save path unavailable", { engineId: game.engineId, error: (err as Error)?.message });
    return null;
  }
}

export function getConsoleCacheDir(cacheRoot: string, consoleId: ConsoleID | string): string {
  return path.join(cacheRoot, consoleId);
}

export function getSaveRoots(game: Game, cacheRoot: string): SaveRoot[] {
  const consoleCache = getConsoleCacheDir(cacheRoot, game.consoleId);
  const primary = safeSavePath(game);
  const base = safeBasePath(game.engineId);
  const roots: (SaveRoot | null)[] = [];

  switch (game.engineId) {
    case "mesen":
      roots.push(
        primary && {
          id: "saves",
          scope: "per-game",
          dir: primary,
          cacheDir: consoleCache,
          extensions: MESEN_SAVE_EXTENSIONS,
          importFormats: ["battery-raw", "rtc-companion"],
          importFileName: namedAfterRom,
        },
        base && {
          id: "savestates",
          scope: "per-game",
          dir: path.join(base, "SaveStates"),
          cacheDir: path.join(consoleCache, "savestates"),
          extensions: [".mss"],
          importFormats: ["mesen-savestate"],
          importFileName: namedAfterRomWithSlot,
        },
      );
      break;

    case "ares":
      roots.push(
        {
          id: "rom-adjacent",
          scope: "per-game",
          dir: path.dirname(game.filePath),
          cacheDir: consoleCache,
          extensions: ARES_SAVE_EXTENSIONS,
          importFormats: ARES_IMPORT_FORMATS,
          importFileName: namedAfterRom,
        },
        base && {
          id: "ares-saves",
          scope: "per-game",
          dir: path.join(base, "Saves"),
          cacheDir: path.join(consoleCache, "ares-saves"),
          extensions: ARES_SAVE_EXTENSIONS,
          recursive: true,
          importFormats: ARES_IMPORT_FORMATS,
        },
      );
      break;

    case "melonds":.
      roots.push(
        primary && {
          id: "rom-adjacent",
          scope: "per-game",
          dir: primary,
          cacheDir: consoleCache,
          extensions: MELONDS_SAVE_EXTENSIONS,
          importFormats: ["ds-battery", "ds-dsv"],
          importFileName: namedAfterRom,
        },
      );
      break;

    case "dolphin":
      if (game.consoleId === "wii") {
        roots.push(
          primary && {
            id: "wii-nand",
            scope: "shared",
            dir: primary,
            cacheDir: consoleCache,
            recursive: true,
            excludeDirs: ["import", "tmp", "cache"],
            importPatterns: […
              /^title\/[0-9a-f]{8}\/[0-9a-f]{8}\/(data|content)\/.+/i,
              /^(shared1|shared2|sys|ticket|meta|wfs)\/.+/,
              /^fst\.bin$/,
            ],
          },
        );
      } else {
        roots.push(
          primary && {
            id: "gc-memcards",
            scope: "shared",
            dir: primary,
            cacheDir: consoleCache,
            extensions: [".gci", ".raw"],
            recursive: true,
            importFormats: ["gc-gci", "gc-memcard-raw", "gc-sram"],
            importPatterns: [
              /^(USA|EUR|JAP)\/Card [AB]\/[^/]+\.gci$/,
              /^MemoryCard[AB]\.(USA|EUR|JAP)\.raw$/,
              /^SRAM\.raw$/,
            ],
            importFileName: gcMemcardName,
          },
        );
      }
      roots.push(
        base && {
          id: "savestates",
          scope: "shared",
          dir: path.join(base, "StateSaves"),
          cacheDir: path.join(cacheRoot, "_shared", "dolphin-savestates"),
          recursive: false,
        },
      );
      break;

    case "azahar":
      roots.push(
        primary && {
          id: "sdmc",
          scope: "shared",
          dir: primary,
          cacheDir: path.join(consoleCache, "sdmc"),
          recursive: true,
          excludeDirs: ["DCIM"],
          importPatterns: [
            /^Nintendo 3DS\/[0-9a-f]{32}\/[0-9a-f]{32}\/(title|extdata)\/.+/i,
            /^Nintendo 3DS\/Private\/.+/,
          ],
        },
        base && {
          id: "nand-data",
          scope: "shared",
          dir: path.join(base, "nand", "data"),
          cacheDir: path.join(consoleCache, "nand-data"),
          recursive: true,
          importPatterns: [/^[0-9a-f]{32}\/(sysdata|extdata)\/.+/i],
        },
      );
      break;

    case "duckstation":
      roots.push(
        primary && {
          id: "memcards",
          scope: "shared",
          dir: primary,
          cacheDir: consoleCache,
          extensions: [".mcd", ".mcr", ".ps", ".srm"],
          importFormats: ["ps1-memcard"],
          importFileName: duckStationMemcardName,
        },
        base && {
          id: "savestates",
          scope: "shared",
          dir: path.join(base, "savestates"),
          cacheDir: path.join(consoleCache, "savestates"),
          extensions: [".sav"],
          importFormats: ["duckstation-savestate"],
          importFileName: verbatimName,
        },
      );
      break;

    case "pcsx2":
      roots.push(
        primary && {
          id: "memcards",
          scope: "shared",
          dir: primary,
          cacheDir: consoleCache,
          extensions: [".ps2", ".mcd", ".mcr"],
          importFormats: ["ps2-memcard", "ps1-memcard"],
          importFileName: pcsx2MemcardName,
        },
        base && {
          id: "savestates",
          scope: "shared",
          dir: path.join(base, "sstates"),
          cacheDir: path.join(consoleCache, "savestates"),
          extensions: [".p2s"],
          importFormats: ["pcsx2-savestate"],
          importFileName: verbatimName,
        },
      );
      break;

    default:
      roots.push(
        primary && {
          id: "saves",
          scope: "per-game",
          dir: primary,
          cacheDir: consoleCache,
          extensions: [".sav"],
        },
      );
  }

  return roots.filter((r): r is SaveRoot => Boolean(r));
}
