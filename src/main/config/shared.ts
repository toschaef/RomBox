// emulator versions
export const MESEN_VERSION = '2.1.1';
export const MELON_VERSION = '1.1';
export const AZAHAR_VERSION = '2123.3';
export const DOLPHIN_VERSION = '2407';


export const MESEN_SHARED = {
  name: 'Mesen 2',
  installDir: 'mesen',
  downloads: {
    win32: `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_Windows.zip`,
    darwin: process.arch === 'arm64'
    ? `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_macOS_ARM64_AppleSilicon.zip`
    : `https://github.com/SourMesen/Mesen2/releases/download/${MESEN_VERSION}/Mesen_${MESEN_VERSION}_macOS_x64_Intel.zip`
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
  getLaunchCommand: (game: any, binPath: string) => [binPath, game.filePath]
};

export const DOLPHIN_SHARED = {
  name: 'Dolphin',
  installDir: 'dolphin',
  downloads: {
    win32: `https://dl.dolphin-emu.org/releases/${DOLPHIN_VERSION}/dolphin-${DOLPHIN_VERSION}-x64.7z`,
    darwin: `https://dl.dolphin-emu.org/releases/${DOLPHIN_VERSION}/dolphin-${DOLPHIN_VERSION}-universal.dmg`,
  },
  binaries: {
    win32: 'Dolphin.exe',
    darwin: 'Dolphin.app/Contents/MacOS/Dolphin', 
  },
  getLaunchCommand: (game: any, binPath: string) => [binPath, '-b', '-e', game.filePath]
};