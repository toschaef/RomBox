import path from "path";
import type { EmulatorPaths } from "../types";

/** Azahar (3DS). */
export const azaharPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.posix.join(r.appSupport, "Azahar"),
    config: (_r, base) => path.posix.join(base, "config"),
    bios: (_r, base) => base,
    saves: ({ base }) => path.posix.join(base, "sdmc"),
  },
  win32: {
    base: (r) => path.win32.join(r.appSupport, "Azahar"),
    config: (_r, base) => path.win32.join(base, "config"),
    bios: (_r, base) => base,
    saves: ({ base }) => path.win32.join(base, "sdmc"),
  },
};
