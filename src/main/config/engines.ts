import { EngineConfig, Game } from '../../shared/types';
import path from 'path';
import { homedir } from 'os';
import { IS_MAC } from '../../shared/constants'
import { MESEN_SHARED, DOLPHIN_SHARED,
         MELON_VERSION, RMG_VERSION, ARES_VERSION, AZAHAR_VERSION
        } from './shared';



export const ENGINES: Record<string, EngineConfig> = {
  nes: {
    ...MESEN_SHARED,
    id: 'nes',
    acceptedExtensions: ['.nes', '.unf'],
    detect: (buffer) => buffer.length > 4 && buffer[0] === 0x4E && buffer[1] === 0x45 && buffer[2] === 0x53 && buffer[3] === 0x1A
  },
  
  snes: {
    ...MESEN_SHARED,
    id: 'snes',
    acceptedExtensions: ['.sfc', '.smc', '.snes'],
    detect: () => false
  },
  
  gb: {
    ...MESEN_SHARED,
    id: 'gb',
    acceptedExtensions: ['.gb', '.gbc'],
    detect: () => false
  },
  
  gba: {
    ...MESEN_SHARED,
    id: 'gba',
    acceptedExtensions: ['.gba'],
    detect: () => false,
    bios: {
      files: [
        { filename: 'gba_bios.bin', description: 'Game Boy Advance BIOS' }
      ]
    }
  },

  gg: {
    ...MESEN_SHARED,
    id: 'gg',
    acceptedExtensions: ['.gg'],
    detect: () => false
  },

  sms: {
    ...MESEN_SHARED,
    id: 'sms',
    acceptedExtensions: ['.sms'],
    detect: () => false
  },

  pce: {
    ...MESEN_SHARED,
    id: 'pce',
    acceptedExtensions: ['.pce', 'xq.sgx'],
    detect: () => false
  },

  n64: {
    id: 'n64',
    name: IS_MAC ? 'Ares' : 'RMG',
    installDir: IS_MAC ? 'ares' : 'rmg',
    
    acceptedExtensions: ['.n64', '.z64', '.v64'],
    detect: (buffer) => {
      if (buffer.length < 4) return false;
      const magic = buffer.readUInt32BE(0);
      return [0x80371240, 0x37804012, 0x40123780].includes(magic);
    },
    
    downloads: {
      win32: `https://github.com/Rosalie241/RMG/releases/download/v${RMG_VERSION}/RMG-Portable-Windows64-v${RMG_VERSION}.zip`,
      linux: `https://github.com/Rosalie241/RMG/releases/download/v${RMG_VERSION}/RMG-Portable-Linux64-v${RMG_VERSION}.AppImage`,
      darwin: `https://github.com/ares-emulator/ares/releases/download/v${ARES_VERSION}/ares-macos-universal.zip`
    },
    
    binaries: {
      win32: 'RMG.exe',
      linux: `RMG-Portable-Linux64-v${RMG_VERSION}.AppImage`,
      darwin: `ares-v${ARES_VERSION}/ares.app/Contents/MacOS/ares`
    },
    
    getLaunchCommand: (game: Game, binPath: string) => {
      if (IS_MAC) {
        return [
          binPath,
          game.filePath
        ];
      }

      return [
        binPath,
        '--nogui',
        game.filePath
      ];
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