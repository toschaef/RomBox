import path from "path";
import type { EmulatorPaths } from "../types";

export const mesenPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.join(r.appSupport, "Mesen2"),
    bios: (_r, base) => path.join(base, "Firmware"),
    saves: ({ base }) => path.join(base, "Saves"),
  },
  win32: {
    base: (r) => path.join(r.documents, "Mesen2"),
    bios: (_r, base) => path.join(base, "Firmware"),
    saves: ({ base }) => path.join(base, "Saves"),
  },
};
