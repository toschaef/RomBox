import path from "path";
import {
  extensionOf,
  romBasename,
  verbatimName,
  type ImportNameContext,
  type ImportNameResult,
  type SaveRootBuilder,
} from "../saveRoots";

/** DuckStation names per-game memory cards `<rom>_<slot>`; imports land in slot 1. */
function duckStationMemcardName({ game, sourceName }: ImportNameContext): ImportNameResult {
  return { relPath: `${romBasename(game)}_1${extensionOf(sourceName)}` };
}

export const duckstationSaveRoots: SaveRootBuilder = ({ primary, base, consoleCache }) => [
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
];
