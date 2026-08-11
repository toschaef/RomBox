import path from "path";
import type { EmulatorPaths } from "../types";

/** PCSX2 (PS2). */
export const pcsx2Paths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.join(r.appSupport, "PCSX2"),
    config: (_r, base) => path.join(base, "inis"),
    bios: (_r, base) => path.join(base, "bios"),
    saves: ({ base }) => path.join(base, "memcards"),
  },
  win32: {
    base: (r) => path.join(r.documents, "PCSX2"),
    config: (_r, base) => path.join(base, "inis"),
    bios: (_r, base) => path.join(base, "bios"),
    saves: ({ base }) => path.join(base, "memcards"),
  },
};
