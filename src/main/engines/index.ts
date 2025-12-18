import { EngineConfig } from '../../shared/types';

const getMesenMacUrl = () => { // todo make a system to manage urls cleaner
  const version = '2.1.1';
  return process.arch === 'arm64'
    ? `https://github.com/SourMesen/Mesen2/releases/download/${version}/Mesen_${version}_macOS_ARM64_AppleSilicon.zip`
    : `https://github.com/SourMesen/Mesen2/releases/download/${version}/Mesen_${version}_macOS_x64_Intel.zip`;
};

export const ENGINES: Record<string, EngineConfig> = {
  mesen: {
    id: 'nes',
    name: 'Mesen 2',
    acceptedExtensions: ['.nes', 'snes', 'gb', 'gbc', 'gba', '.zip'],
    
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
        platform: 'darwin',
        url: 'https://github.com/libsdl-org/SDL/releases/download/release-2.30.3/SDL2-2.30.3.dmg',
        filename: 'libSDL2-2.0.0.dylib',
        sourceName: 'SDL2'
      }
    ],

    detect: (buffer: Buffer) => {
      // check for iNES header
      return buffer.length > 4 && 
             buffer[0] === 0x4E && 
             buffer[1] === 0x45 && 
             buffer[2] === 0x53 && 
             buffer[3] === 0x1A;
    },

    getLaunchCommand: (game, emulatorPath) => {
      return [emulatorPath, game.filePath];
    }
  }
};