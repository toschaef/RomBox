import type { EngineDefinition, EngineID, LaunchOptions } from "../../shared/types/engines";
import { ENGINE_CATALOG } from "../../shared/emulators/catalog";
import { getConsoleIdsForEngine } from "../../shared/emulators/derived";
import type { Game } from "../../shared/types";
import fs from "fs";
import path from "path";

export const MESEN_VERSION = '2.1.1';
export const ARES_VERSION = '146';
export const MELON_VERSION = '1.1';
export const AZAHAR_VERSION = '2123.3';
export const DOLPHIN_VERSION = '2407';
export const PCSX2_VERSION = 'v2.6.2';

export const ENGINES: Record<EngineID, EngineDefinition> = {
  mesen: {
    engineId: "mesen",
    name: ENGINE_CATALOG["mesen"].displayName,
    consoles: getConsoleIdsForEngine("mesen"),
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
    getLaunchCommand: (game: Game, binPath: string, options?: LaunchOptions) => {
      const args = [binPath];
      if (options?.fullscreen) args.push("--fullscreen");
      args.push(game.filePath);
      return args;
    },
  },

  melonds: {
    engineId: "melonds",
    name: ENGINE_CATALOG["melonds"].displayName,
    consoles: getConsoleIdsForEngine("melonds"),
    downloads: {
      win32: `https://github.com/melonDS-emu/melonDS/releases/download/${MELON_VERSION}/melonDS-${MELON_VERSION}-windows-x86_64.zip`,
      darwin: `https://github.com/melonDS-emu/melonDS/releases/download/${MELON_VERSION}/melonDS-${MELON_VERSION}-macOS-universal.zip`,
    },
    binaries: {
      win32: "melonDS.exe",
      darwin: "melonDS.app/Contents/MacOS/melonDS",
    },
    getLaunchCommand: (game, binPath, options?: LaunchOptions) => {
      const args = [binPath];
      if (options?.fullscreen) args.push("--fullscreen");
      args.push(game.filePath);
      return args;
    },
  },

  azahar: {
    engineId: "azahar",
    name: ENGINE_CATALOG["azahar"].displayName,
    consoles: getConsoleIdsForEngine("azahar"),
    downloads: {
      win32: `https://github.com/azahar-emu/azahar/releases/download/${AZAHAR_VERSION}/azahar-${AZAHAR_VERSION}-windows-msvc.zip`,
      darwin: `https://github.com/azahar-emu/azahar/releases/download/${AZAHAR_VERSION}/azahar-${AZAHAR_VERSION}-macos-universal.zip`,
    },
    binaries: {
      win32: "azahar.exe",
      darwin: `azahar-${AZAHAR_VERSION}-macos-universal/Azahar.app/Contents/MacOS/azahar`,
    },
    getLaunchCommand: (game, binPath) => [binPath, game.filePath],
  },

  dolphin: {
    engineId: "dolphin",
    name: ENGINE_CATALOG["dolphin"].displayName,
    consoles: getConsoleIdsForEngine("dolphin"),
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
    name: ENGINE_CATALOG["ares"].displayName,
    consoles: getConsoleIdsForEngine("ares"),
    downloads: {
      win32: `https://github.com/ares-emulator/ares/releases/download/v${ARES_VERSION}/ares-windows-x64.zip`,
      darwin: `https://github.com/ares-emulator/ares/releases/download/v${ARES_VERSION}/ares-macos-universal.zip`,
    },
    binaries: {
      win32: `ares-v${ARES_VERSION}/ares.exe`,
      darwin: `ares-v${ARES_VERSION}/ares.app/Contents/MacOS/ares`,
    },
    getLaunchCommand: (game, binPath, options?: LaunchOptions) => {
      const args = [binPath];
      if (options?.fullscreen) args.push("--fullscreen");
      args.push(game.filePath);
      return args;
    },
  },

  duckstation: {
    engineId: "duckstation",
    name: ENGINE_CATALOG["duckstation"].displayName,
    consoles: getConsoleIdsForEngine("duckstation"),
    downloads: {
      win32: "https://github.com/stenzek/duckstation/releases/latest/download/duckstation-windows-x64-release.zip",
      darwin: "https://github.com/stenzek/duckstation/releases/latest/download/duckstation-mac-release.zip",
      linux: "https://github.com/stenzek/duckstation/releases/latest/download/DuckStation-x64.AppImage",
    },
    binaries: {
      win32: "duckstation-qt-x64-ReleaseLTCG.exe",
      darwin: "DuckStation.app/Contents/MacOS/DuckStation",
      linux: "DuckStation-x64.AppImage",
    },
    getLaunchCommand: (game, binPath) => {
      let gamePath = game.filePath;

      if (fs.existsSync(gamePath) && fs.statSync(gamePath).isDirectory()) {
        const files = fs.readdirSync(gamePath);
        const cueFile = files.find(f => f.toLowerCase().endsWith('.cue'));
        if (cueFile) {
          gamePath = path.join(gamePath, cueFile);
        }
      }

      return [
        binPath,
        "--",
        gamePath,
      ];
    },
  },

  pcsx2: {
    engineId: "pcsx2",
    name: ENGINE_CATALOG["pcsx2"].displayName,
    consoles: getConsoleIdsForEngine("pcsx2"),
    downloads: {
      win32: `https://github.com/PCSX2/pcsx2/releases/download/${PCSX2_VERSION}/pcsx2-${PCSX2_VERSION}-windows-x64-Qt.7z`,
      darwin: `https://github.com/PCSX2/pcsx2/releases/download/${PCSX2_VERSION}/pcsx2-${PCSX2_VERSION}-macos-Qt.tar.xz`,
      linux: `https://github.com/PCSX2/pcsx2/releases/download/${PCSX2_VERSION}/pcsx2-${PCSX2_VERSION}-linux-appimage-x64-Qt.AppImage`,
    },
    binaries: {
      win32: "pcsx2-qt.exe",
      darwin: `PCSX2-${PCSX2_VERSION}.app/Contents/MacOS/PCSX2`,
      linux: `pcsx2-${PCSX2_VERSION}-linux-appimage-x64-Qt.AppImage`,
    },
    getLaunchCommand: (game, binPath) => [
      binPath,
      "-nogui",
      "--",
      game.filePath,
    ],
  },
};