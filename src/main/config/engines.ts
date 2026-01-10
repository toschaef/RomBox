import type { EngineDefinition } from "../../shared/types/engines";
import type { Game } from "../../shared/types";

export const MESEN_VERSION = '2.1.1';
export const RMG_VERSION = '0.6.5';
export const ARES_VERSION = '146';
export const MELON_VERSION = '1.1';
export const AZAHAR_VERSION = '2123.3';
export const DOLPHIN_VERSION = '2407';

export const ENGINES: Record<string, EngineDefinition> = {
  mesen: {
    engineId: "mesen",
    name: "Mesen 2",
    consoles: ["nes", "snes", "gb", "gba", "gg", "sms", "pce"],
    downloads: {
      win32: `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_Windows.zip`,
      darwin:
        process.arch === "arm64"
          ? `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_macOS_ARM64_AppleSilicon.zip`
          : `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_macOS_x64_Intel.zip`,
    },
    binaries: {
      win32: "Mesen.exe",
      darwin: "Mesen.app/Contents/MacOS/Mesen",
    },
    dependencies: [
      {
        platform: "darwin",
        url: "https://github.com/libsdl-org/SDL/releases/download/release-2.30.3/SDL2-2.30.3.dmg",
        filename: "libSDL2-2.0.0.dylib",
        sourceName: "SDL2",
      },
    ],
    getLaunchCommand: (game: Game, binPath: string) => [binPath, game.filePath],
  },

  melonds: {
    engineId: "melonds",
    name: "MelonDS",
    consoles: ["ds"],
    downloads: {
      win32: `https://github.com/melonDS-emu/melonDS/releases/download/${MELON_VERSION}/melonDS-${MELON_VERSION}-windows-x86_64.zip`,
      darwin: `https://github.com/melonDS-emu/melonDS/releases/download/${MELON_VERSION}/melonDS-${MELON_VERSION}-macOS-universal.zip`,
    },
    binaries: {
      win32: "melonDS.exe",
      darwin: "melonDS.app/Contents/MacOS/melonDS",
    },
    getLaunchCommand: (game, binPath) => [binPath, game.filePath],
  },

  azahar: {
    engineId: "azahar",
    name: "Azahar",
    consoles: ["3ds"],
    downloads: {
      win32: `https://github.com/azahar-emu/azahar/releases/download/${AZAHAR_VERSION}/azahar-${AZAHAR_VERSION}-windows-msvc.zip`,
      darwin: `https://github.com/azahar-emu/azahar/releases/download/${AZAHAR_VERSION}/azahar-${AZAHAR_VERSION}-macos-universal.zip`,
    },
    binaries: {
      win32: "azahar-gui.exe",
      darwin: `azahar-${AZAHAR_VERSION}-macos-universal/Azahar.app/Contents/MacOS/azahar`,
    },
    getLaunchCommand: (game, binPath) => [binPath, game.filePath],
  },

  dolphin: {
    engineId: "dolphin",
    name: "Dolphin",
    consoles: ["gc", "wii"],
    downloads: {
      win32: `https://dl.dolphin-emu.org/releases/${DOLPHIN_VERSION}/dolphin-${DOLPHIN_VERSION}-x64.7z`,
      darwin: `https://dl.dolphin-emu.org/releases/${DOLPHIN_VERSION}/dolphin-${DOLPHIN_VERSION}-universal.dmg`,
    },
    binaries: {
      win32: "Dolphin.exe",
      darwin: "Dolphin.app/Contents/MacOS/Dolphin",
    },
    getLaunchCommand: (game, binPath) => [
      binPath,
      "-b",
      "-C",
      "Display.RenderToMain=False",
      "-C",
      "Interface.ShowMainWindow=False",
      "-C",
      "Interface.ConfirmStop=False",
      "-e",
      game.filePath,
    ],
  },

  ares: {
    engineId: "ares",
    name: "Ares",
    consoles: ["n64"],
    downloads: {
      darwin: `https://github.com/ares-emulator/ares/releases/download/v${ARES_VERSION}/ares-macos-universal.zip`,
    },
    binaries: {
      darwin: `ares-v${ARES_VERSION}/ares.app/Contents/MacOS/ares`,
    },
    getLaunchCommand: (game, binPath) => [binPath, game.filePath],
  },

  rmg: {
    engineId: "rmg",
    name: "RMG",
    consoles: ["n64"],
    downloads: {
      win32: `https://github.com/Rosalie241/RMG/releases/download/v${RMG_VERSION}/RMG-Portable-Windows64-v${RMG_VERSION}.zip`,
      linux: `https://github.com/Rosalie241/RMG/releases/download/v${RMG_VERSION}/RMG-Portable-Linux64-v${RMG_VERSION}.AppImage`,
    },
    binaries: {
      win32: "RMG.exe",
      linux: `RMG-Portable-Linux64-v${RMG_VERSION}.AppImage`,
    },
    getLaunchCommand: (game, binPath) => [binPath, "--nogui", game.filePath],
  },
};