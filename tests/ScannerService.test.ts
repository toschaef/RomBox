import { ScannerService } from '../src/main/services/ScannerService';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { SIGNATURES } from '../src/shared/constants';

type ScanResult = 
  | { type: 'game'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'bios'; consoleId: string; filePath: string; zipEntryName?: string }
  | { type: 'unknown' };

jest.mock('fs');
jest.mock('fs/promises');
jest.mock('../src/main/utils/extractor');
jest.mock('electron', () => ({ app: { getPath: () => '/mock/userData' } }));

jest.mock('../src/main/utils/fsUtils', () => ({
  scanZipEntries: jest.fn(),
  extractZipEntry: jest.fn().mockResolvedValue(undefined)
}));
import { scanZipEntries } from '../src/main/utils/fsUtils';

describe('ScannerService', () => {
  const mockStat = fs.statSync as jest.Mock;
  const mockOpen = fsPromises.open as jest.Mock;
  const mockZipScan = scanZipEntries as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStat.mockReturnValue({ size: 1024 }); 
  });

  describe('Standard Extensions', () => {
    test('should identify GBA games by extension', async () => {
      const result = await ScannerService.scanFile('/roms/Pokemon.gba');
      expect(result).toEqual(expect.objectContaining({ type: 'game', consoleId: 'gba' }));
    });

    test('should identify 3DS games by .cia extension', async () => {
      const result = await ScannerService.scanFile('/roms/Game.cia');
      expect(result).toEqual(expect.objectContaining({ type: 'game', consoleId: '3ds' }));
    });

    test('should return unknown for .txt files', async () => {
      const result = await ScannerService.scanFile('/roms/readme.txt');
      expect(result).toEqual({ type: 'unknown' });
    });
  });

  describe('Ambiguous Files (.rvz)', () => {
    test('should identify .rvz as GameCube if size is small (<1.5GB)', async () => {
      // 1GB
      mockStat.mockReturnValue({ size: 1024 * 1024 * 1024 }); 
      
      const result = await ScannerService.scanFile('/roms/Melee.rvz');
      expect(result).toEqual(expect.objectContaining({ consoleId: 'gc' }));
    });

    test('should identify .rvz as Wii if size is large (>1.5GB)', async () => {
      // 2GB
      mockStat.mockReturnValue({ size: 2 * 1024 * 1024 * 1024 }); 

      const result = await ScannerService.scanFile('/roms/Brawl.rvz');
      expect(result).toEqual(expect.objectContaining({ consoleId: 'wii' }));
    });
  });

  describe('Header Detection (.iso)', () => {
    const mockHeaderRead = (signatureBytes: number[], offset: number) => {
      const fileHandle = {
        read: jest.fn().mockImplementation(async (buffer: Buffer) => {
          signatureBytes.forEach((byte, i) => {
            buffer[offset + i] = byte;
          });
          return { bytesRead: buffer.length };
        }),
        close: jest.fn()
      };
      mockOpen.mockResolvedValue(fileHandle);
    };

    test('should identify GameCube ISO via magic header', async () => {
      const gcSig = SIGNATURES.find(s => s.id === 'gc');
      if (!gcSig) throw new Error('GC signature missing in constants');

      mockHeaderRead(gcSig.bytes, gcSig.offset);

      const result = await ScannerService.scanFile('/roms/game.iso');
      expect(result).toEqual(expect.objectContaining({ consoleId: 'gc' }));
    });

    test('should identify Wii ISO via magic header', async () => {
      const wiiSig = SIGNATURES.find(s => s.id === 'wii');
      if (!wiiSig) throw new Error('Wii signature missing in constants');

      mockHeaderRead(wiiSig.bytes, wiiSig.offset);

      const result = await ScannerService.scanFile('/roms/game.iso');
      expect(result).toEqual(expect.objectContaining({ consoleId: 'wii' }));
    });

    test('should return unknown if ISO header does not match', async () => {
      mockHeaderRead([0x00, 0x00, 0x00, 0x00], 0);

      const result = await ScannerService.scanFile('/roms/unknown.iso');
      expect(result).toEqual({ type: 'unknown' });
    });
  });

  describe('Archive Scanning (.zip)', () => {
    test('should find a game inside a zip file', async () => {
      mockZipScan.mockResolvedValue([
        { fileName: 'manual.pdf', uncompressedSize: 500 },
        { fileName: 'SuperMario.sfc', uncompressedSize: 2048 }
      ]);

      const result = await ScannerService.scanFile('/roms/bundle.zip');
      
      expect(result).toEqual({
        type: 'game',
        consoleId: 'snes',
        filePath: '/roms/bundle.zip',
        zipEntryName: 'SuperMario.sfc'
      });
    });

    test('should prioritize identifying BIOS files inside zip', async () => {
      mockZipScan.mockResolvedValue([
        { fileName: 'random_game.gba', uncompressedSize: 2048 },
        { fileName: 'bios7.bin', uncompressedSize: 1024 }
      ]);

      const result = await ScannerService.scanFile('/roms/pack.zip');
      
      expect(result).toEqual({
        type: 'bios',
        consoleId: 'ds',
        filePath: '/roms/pack.zip',
        zipEntryName: 'bios7.bin'
      });
    });
  });

  describe('Import Logic (Edge Cases)', () => {
    test('should rename file if duplicate exists', async () => {

      const scanResult: ScanResult = { type: 'game', consoleId: 'nes', filePath: '/source/mario.nes' };
      
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      (fs.copyFileSync as jest.Mock).mockReturnValue(undefined);

      const importedGame = await ScannerService.importGame(scanResult);

      // expect timestamp appended to filename
      expect(importedGame.filePath).toMatch(/mario_\d+\.nes/);
      expect(fs.copyFileSync).toHaveBeenCalled();
    });
  });
});