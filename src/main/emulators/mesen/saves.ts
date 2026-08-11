import path from "path";
import {
  namedAfterRom,
  namedAfterRomWithSlot,
  type SaveRootBuilder,
} from "../saveRoots";

const MESEN_SAVE_EXTENSIONS = [".sav", ".srm", ".sram", ".rtc", ".eep", ".flash"];

export const mesenSaveRoots: SaveRootBuilder = ({ primary, base, consoleCache }) => [
  primary && {
    id: "saves",
    scope: "per-game",
    dir: primary,
    cacheDir: consoleCache,
    extensions: MESEN_SAVE_EXTENSIONS,
    importFormats: ["battery-raw", "rtc-companion"],
    importFileName: namedAfterRom,
  },
  base && {
    id: "savestates",
    scope: "per-game",
    dir: path.join(base, "SaveStates"),
    cacheDir: path.join(consoleCache, "savestates"),
    extensions: [".mss"],
    importFormats: ["mesen-savestate"],
    importFileName: namedAfterRomWithSlot,
  },
];
