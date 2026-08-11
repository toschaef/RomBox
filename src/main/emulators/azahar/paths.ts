import path from "path";
import type { EmulatorPaths } from "../types";

/** Azahar (3DS). */
export const azaharPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.join(r.appSupport, "Azahar"),
    config: (_r, base) => path.join(base, "config"),
    bios: (_r, base) => base,
    saves: ({ base }) => path.join(base, "sdmc"),
  },
  win32: {
    base: (r) => path.join(r.appSupport, "Azahar"),
    config: (_r, base) => path.join(base, "config"),
    bios: (_r, base) => base,
    saves: ({ base }) => path.join(base, "sdmc"),
  },
};
