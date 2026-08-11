import path from "path";
import type { EmulatorPaths } from "../types";

/** DuckStation (PS1). */
export const duckstationPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.join(r.appSupport, "DuckStation"),
    bios: (_r, base) => path.join(base, "bios"),
    saves: ({ base }) => path.join(base, "memcards"),
  },
  win32: {
    base: (r) => path.join(r.documents, "DuckStation"),
    bios: (_r, base) => path.join(base, "bios"),
    saves: ({ base }) => path.join(base, "memcards"),
  },
};
