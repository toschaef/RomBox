import path from "path";
import type { EmulatorPaths } from "../types";

export const dolphinPaths: Record<"darwin" | "win32", EmulatorPaths> = {
  darwin: {
    base: (r) => path.posix.join(r.appSupport, "Dolphin"),
    config: (_r, base) => path.posix.join(base, "Config"),
    saves: ({ game, base }) => path.posix.join(base, game.consoleId === "wii" ? "Wii" : "GC"),
  },
  win32: {
    base: (r) => path.win32.join(r.appSupport, "Dolphin Emulator"),
    config: (_r, base) => path.win32.join(base, "Config"),
    saves: ({ game, base }) => path.win32.join(base, game.consoleId === "wii" ? "Wii" : "GC"),
  },
};
