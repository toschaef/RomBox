import path from "path";

import type { Game } from "../../shared/types";
import type { SaveFormatID } from "../config/saveFormats";

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
  /**
   * the emulator insists on writing here but rombox does not own the directory
   * (rom-adjacent saves in the user's own folders). files are removed once they
   * are safely in the cache, and re-injected on the next launch.
   */
  ephemeral?: boolean;

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

export interface SaveRootContext {
  game: Game;
  /** the root of RomBox's save cache */
  cacheRoot: string;
  /** this console's directory inside the save cache */
  consoleCache: string;
  /** the emulator's save directory for this game, per osHandler */
  primary: string | null;
  /** the emulator's base directory, per osHandler */
  base: string | null;
}

export type SaveRootBuilder = (ctx: SaveRootContext) => Array<SaveRoot | null | undefined>;

export function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

export function romBasename(game: Game): string {
  return path.basename(game.filePath, path.extname(game.filePath));
}

/** `<rom name>.<original extension>` */
export function namedAfterRom({ game, sourceName }: ImportNameContext): ImportNameResult {
  return { relPath: `${romBasename(game)}${extensionOf(sourceName)}` };
}

/** `<rom name>_<slot>.<original extension>`, slot taken from the source name */
export function namedAfterRomWithSlot({ game, sourceName }: ImportNameContext): ImportNameResult {
  const stem = path.basename(sourceName, path.extname(sourceName));
  const slot = /_(\d+)$/.exec(stem)?.[1] ?? "1";
  return { relPath: `${romBasename(game)}_${slot}${extensionOf(sourceName)}` };
}

/** keep the file name the user chose */
export function verbatimName({ sourceName }: ImportNameContext): ImportNameResult {
  return { relPath: sourceName };
}
