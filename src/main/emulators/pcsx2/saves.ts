import path from "path";
import {
  extensionOf,
  verbatimName,
  type ImportNameContext,
  type ImportNameResult,
  type SaveRootBuilder,
} from "../saveRoots";

// PCSX2 memory cards are slot-named, not game-named
function pcsx2MemcardName({ sourceName }: ImportNameContext): ImportNameResult {
  if (/^Mcd\d{3}\.(ps2|mcd)$/i.test(sourceName)) return { relPath: sourceName };
  return { relPath: `Mcd001${extensionOf(sourceName)}` };
}

export const pcsx2SaveRoots: SaveRootBuilder = ({ primary, base, consoleCache }) => [
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
];
