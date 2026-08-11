import path from "path";
import type { EmulatorPaths } from "../types";

export const aresPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.join(r.appSupport, "ares"),
    saves: ({ game }) => path.dirname(game.filePath),
  },
  win32: {
    base: (r) => path.join(r.localAppData, "ares"),
    saves: ({ game }) => path.dirname(game.filePath),
  },
};
