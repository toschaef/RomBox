import path from "path";
import type { EmulatorPaths } from "../types";

/** DuckStation (PS1). */
export const duckstationPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.posix.join(r.appSupport, "DuckStation"),
    bios: (_r, base) => path.posix.join(base, "bios"),
    saves: ({ base }) => path.posix.join(base, "memcards"),
  },
  win32: {
    base: (r) => path.win32.join(r.documents, "DuckStation"),
    bios: (_r, base) => path.win32.join(base, "bios"),
    saves: ({ base }) => path.win32.join(base, "memcards"),
  },
};
