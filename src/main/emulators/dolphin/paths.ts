import path from "path";
import type { EmulatorPaths } from "../types";

export const dolphinPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.join(r.appSupport, "Dolphin"),
    config: (_r, base) => path.join(base, "Config"),
    saves: ({ game, base }) => path.join(base, game.consoleId === "wii" ? "Wii" : "GC"),
  },
  win32: {
    base: (r) => path.join(r.appSupport, "Dolphin Emulator"),
    config: (_r, base) => path.join(base, "Config"),
    saves: ({ game, base }) => path.join(base, game.consoleId === "wii" ? "Wii" : "GC"),
  },
};
