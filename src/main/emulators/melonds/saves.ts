import { namedAfterRom, type SaveRootBuilder } from "../saveRoots";

const MELONDS_SAVE_EXTENSIONS = [".sav", ".dsv", ".mln", ".rtc"];

export const melondsSaveRoots: SaveRootBuilder = ({ primary, consoleCache }) => [
  primary && {
    id: "rom-adjacent",
    scope: "per-game",
    dir: primary,
    cacheDir: consoleCache,
    // melonds writes next to the rom, which is usually the user's own folder
    ephemeral: true,
    extensions: MELONDS_SAVE_EXTENSIONS,
    importFormats: ["ds-battery", "ds-dsv"],
    importFileName: namedAfterRom,
  },
];
