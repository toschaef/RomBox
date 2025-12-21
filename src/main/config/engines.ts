import { EngineConfig } from '../../shared/types';
import path from 'path';
import { homedir } from 'os';
import { MESEN_SHARED } from './shared'
import { DOLPHIN_SHARED } from './shared';
import { MELON_VERSION, AZAHAR_VERSION } from './shared';


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
    getLaunchCommand: (game, binPath) => [binPath, game.filePath] 
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
      darwin: `azahar-${AZAHAR_VERSION}-macos-universal/Azahar.app/Contents/MacOS/azahar`, 
    },
    acceptedExtensions: ['.3ds', '.cia', '.cxi'],
    detect: () => false,
    getLaunchCommand: (game, binPath) => [binPath, game.filePath]
  },

  gc: {
    ...DOLPHIN_SHARED,
    id: 'gc',
    acceptedExtensions: ['.iso', '.gcm', '.rvz', '.ciso'],
    detect: (buffer) => {
        if (buffer.length < 0x20) return false;
        return buffer.readUInt32BE(0x1C) === 0xC2339F3D;
    }
  },

  wii: {
    ...DOLPHIN_SHARED,
    id: 'wii',
    acceptedExtensions: ['.iso', '.wbfs', '.rvz'],
    detect: (buffer) => {
        if (buffer.length < 0x20) return false;
        return buffer.readUInt32BE(0x18) === 0x5D1C9EA3;
    }
  },
};