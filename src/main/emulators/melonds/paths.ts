import path from "path";
import type { EmulatorPaths } from "../types";

export const melondsPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.join(r.preferences, "melonDS"),
    bios: (_r, base) => base,
    saves: ({ game }) => path.dirname(game.filePath),
  },
  win32: {
    base: (r) => path.join(r.localAppData, "melonDS"),
    bios: (_r, base) => base,
    saves: ({ game }) => path.dirname(game.filePath),
  },
};
