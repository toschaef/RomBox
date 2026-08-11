import path from "path";
import type { EmulatorPaths } from "../types";

export const aresPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.posix.join(r.appSupport, "ares"),
    saves: ({ game }) => path.posix.dirname(game.filePath),
  },
  win32: {
    base: (r) => path.win32.join(r.localAppData, "ares"),
    saves: ({ game }) => path.win32.dirname(game.filePath),
  },
};
