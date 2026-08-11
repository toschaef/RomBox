import path from "path";
import type { SaveFormatID } from "../../config/saveFormats";
import { namedAfterRom, type SaveRootBuilder } from "../saveRoots";

const ARES_SAVE_EXTENSIONS = [
  ".sav", ".srm", ".sram", ".eeprom", ".flash", ".ram", ".pak", ".rtc",
];

const ARES_IMPORT_FORMATS: SaveFormatID[] = [
  "n64-eeprom", "n64-sram", "n64-flash", "n64-controller-pak",
];

export const aresSaveRoots: SaveRootBuilder = ({ game, base, consoleCache }) => [
  {
    id: "rom-adjacent",
    scope: "per-game",
    dir: path.dirname(game.filePath),
    cacheDir: consoleCache,
    extensions: ARES_SAVE_EXTENSIONS,
    importFormats: ARES_IMPORT_FORMATS,
    importFileName: namedAfterRom,
  },
  base && {
    id: "ares-saves",
    scope: "per-game",
    dir: path.join(base, "Saves"),
    cacheDir: path.join(consoleCache, "ares-saves"),
    extensions: ARES_SAVE_EXTENSIONS,
    recursive: true,
    importFormats: ARES_IMPORT_FORMATS,
  },
];
