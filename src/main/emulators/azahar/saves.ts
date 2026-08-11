import path from "path";
import type { SaveRootBuilder } from "../saveRoots";

export const azaharSaveRoots: SaveRootBuilder = ({ primary, base, consoleCache }) => [
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
];
