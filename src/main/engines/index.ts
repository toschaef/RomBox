import { EngineConfig } from '../../shared/types';

const getMesenMacUrl = () => {
  const version = '2.1.1';
  return process.arch === 'arm64'
    ? `https://github.com/SourMesen/Mesen2/releases/download/${version}/Mesen_${version}_macOS_ARM64_AppleSilicon.zip`
    : `https://github.com/SourMesen/Mesen2/releases/download/${version}/Mesen_${version}_macOS_x64_Intel.zip`;
};

const MESEN_SHARED = {
  name: 'Mesen 2',
  installDir: 'mesen',
  downloads: {
    win32: 'https://github.com/SourMesen/Mesen2/releases/download/2.1.1/Mesen_2.1.1_Windows.zip',
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
      filename: 'gba_bios.bin', 
      description: 'Game Boy Advance BIOS'
    },
  }
};