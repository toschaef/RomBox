import path from "path";
import {
  extensionOf,
  type ImportNameContext,
  type ImportNameResult,
  type SaveRootBuilder,
} from "../saveRoots";

const GC_REGION_BY_CODE: Record<string, string> = { E: "USA", P: "EUR", J: "JAP" };

export function gcMemcardName({ sourceName, buffer }: ImportNameContext): ImportNameResult {
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

export const dolphinSaveRoots: SaveRootBuilder = ({ game, primary, base, cacheRoot, consoleCache }) => [
  game.consoleId === "wii"
    ? primary && {
        id: "wii-nand",
        scope: "shared",
        dir: primary,
        cacheDir: consoleCache,
        recursive: true,
        excludeDirs: ["import", "tmp", "cache"],
        importPatterns: [
          /^title\/[0-9a-f]{8}\/[0-9a-f]{8}\/(data|content)\/.+/i,
          /^(shared1|shared2|sys|ticket|meta|wfs)\/.+/,
          /^fst\.bin$/,
        ],
      }
    : primary && {
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
  base && {
    id: "savestates",
    scope: "shared",
    dir: path.join(base, "StateSaves"),
    // savestates are not console-specific, so GC and Wii share one cache.
    cacheDir: path.join(cacheRoot, "_shared", "dolphin-savestates"),
    recursive: false,
  },
];
