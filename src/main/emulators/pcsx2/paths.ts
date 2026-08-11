import path from "path";
import type { EmulatorPaths } from "../types";

/** PCSX2 (PS2). */
export const pcsx2Paths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.posix.join(r.appSupport, "PCSX2"),
    config: (_r, base) => path.posix.join(base, "inis"),
    bios: (_r, base) => path.posix.join(base, "bios"),
    saves: ({ base }) => path.posix.join(base, "memcards"),
  },
  win32: {
    base: (r) => path.win32.join(r.documents, "PCSX2"),
    config: (_r, base) => path.win32.join(base, "inis"),
    bios: (_r, base) => path.win32.join(base, "bios"),
    saves: ({ base }) => path.win32.join(base, "memcards"),
  },
};
