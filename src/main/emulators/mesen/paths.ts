import path from "path";
import type { EmulatorPaths } from "../types";

export const mesenPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.posix.join(r.appSupport, "Mesen2"),
    bios: (_r, base) => path.posix.join(base, "Firmware"),
    saves: ({ base }) => path.posix.join(base, "Saves"),
  },
  win32: {
    base: (r) => path.win32.join(r.documents, "Mesen2"),
    bios: (_r, base) => path.win32.join(base, "Firmware"),
    saves: ({ base }) => path.win32.join(base, "Saves"),
  },
};
