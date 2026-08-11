import path from "path";
import type { EmulatorPaths } from "../types";

export const melondsPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.posix.join(r.preferences, "melonDS"),
    bios: (_r, base) => base,
    saves: ({ game }) => path.posix.dirname(game.filePath),
  },
  win32: {
    base: (r) => path.win32.join(r.localAppData, "melonDS"),
    bios: (_r, base) => base,
    saves: ({ game }) => path.win32.dirname(game.filePath),
  },
};
