import { EngineConfig } from '../../shared/types';
import path from 'path';
import { homedir } from 'os';

// emulator versions
const MESEN_VERSION = '2.1.1';
const MELON_VERSION = '1.1';
const AZAHAR_VERSION = '2123.3';

const getMesenMacUrl = () =>
  process.arch === 'arm64'
    ? `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_macOS_ARM64_AppleSilicon.zip`
    : `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_macOS_x64_Intel.zip`;

const MESEN_SHARED = {
  name: 'Mesen 2',
  installDir: 'mesen',
  downloads: {
    win32: `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_Windows.zip`,
    darwin: getMesenMacUrl(),
  },
  binaries: {
    win32: 'Mesen.exe',
    darwin: 'Mesen.app/Contents/MacOS/Mesen',
  },
  dependencies: [
    {
      platform: 'darwin' as const,
      url: 'https://github.com/libsdl-org/SDL/releases/download/release-2.30.3/SDL2-2.30.3.dmg',
      filename: 'libSDL2-2.0.0.dylib',
      sourceName: 'SDL2'
    }
  ],
  getLaunchCommand: (game: any, emulatorPath: string) => [emulatorPath, game.filePath]
};

export const ENGINES: Record<string, EngineConfig> = {
  nes: {
    ...MESEN_SHARED,
    id: 'nes',
    acceptedExtensions: ['.nes', '.unf', '.zip'],
    detect: (buffer) => buffer.length > 4 && buffer[0] === 0x4E && buffer[1] === 0x45 && buffer[2] === 0x53 && buffer[3] === 0x1A
  },
  
  snes: {
    ...MESEN_SHARED,
    id: 'snes',
    acceptedExtensions: ['.sfc', '.smc', '.snes', '.zip'],
    detect: () => false
  },
  
  gb: {
    ...MESEN_SHARED,
    id: 'gb',
    acceptedExtensions: ['.gb', '.gbc', '.zip'],
    detect: () => false
  },
  
  gba: {
    ...MESEN_SHARED,
    id: 'gba',
    acceptedExtensions: ['.gba', '.zip'],
    detect: () => false,
        bios: {
      files: [
        { filename: 'gba_bios.bin', description: 'Game Boy Advance BIOS' }
      ]
    }
  },

  ds: {
    id: 'ds',
    name: 'MelonDS',
    installDir: 'melonds',
    bios: {
        installDir: path.join(homedir(), 'Library', 'Preferences', 'melonDS'), 
        files: [
          { filename: 'bios7.bin', description: 'ARM7 BIOS' },
          { filename: 'bios9.bin', description: 'ARM9 BIOS' },
          { filename: 'firmware.bin', description: 'Firmware' }
        ]
    },
    downloads: {
      win32: `https://github.com/melonDS-emu/melonDS/releases/download/${MELON_VERSION}/melonDS-${MELON_VERSION}-windows-x86_64.zip`,
      darwin: `https://github.com/melonDS-emu/melonDS/releases/download/${MELON_VERSION}/melonDS-${MELON_VERSION}-macOS-universal.zip`,
    },
    binaries: {
      win32: 'melonDS.exe',
      darwin: 'melonDS.app/Contents/MacOS/melonDS', 
    },
    acceptedExtensions: ['.nds', '.zip'],
    detect: () => false,
    getLaunchCommand: (game, path) => [path, game.filePath] 
  },

  '3ds': {
    id: '3ds',
    name: 'Azahar',
    installDir: 'azahar',
    downloads: {
      win32: `https://github.com/azahar-emu/azahar/releases/download/${AZAHAR_VERSION}/azahar-${AZAHAR_VERSION}-windows-msvc.zip`,
      darwin: `https://github.com/azahar-emu/azahar/releases/download/${AZAHAR_VERSION}/azahar-${AZAHAR_VERSION}-macos-universal.zip`,
    },
    binaries: {
      win32: 'azahar-gui.exe',
      darwin: 'Azahar.app/Contents/MacOS/Azahar', 
    },
    acceptedExtensions: ['.3ds', '.cia', '.cxi'],
    detect: () => false,
    getLaunchCommand: (game, path) => [path, game.filePath]
  },
};