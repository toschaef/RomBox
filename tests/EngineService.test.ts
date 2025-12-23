import { EngineService } from '../src/main/services/EngineService';
import { Downloader } from '../src/main/utils/downloader';
import { osHandler } from '../src/main/platform';
import fs from 'fs';
import AdmZip from 'adm-zip';

jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    getEntries: jest.fn().mockReturnValue([]),
    extractAllTo: jest.fn()
  }));
});

jest.mock('fs');
jest.mock('../src/main/utils/downloader');
jest.mock('../src/main/platform');
jest.mock('electron', () => ({ app: { getPath: () => '/mock/userData' } }));

describe('EngineService', () => {
  const mockDownload = Downloader.download as jest.Mock;
  const mockResolveBinary = osHandler.resolveBinaryPath as jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.rmSync as jest.Mock).mockReturnValue(undefined);
  });

  describe('installEngine', () => {
    test('should fail if download results in a small (invalid) file', async () => {
      mockDownload.mockResolvedValue('/temp/download.zip');

      (fs.statSync as jest.Mock).mockReturnValue({ size: 500 }); 

      const result = await EngineService.installEngine('nes', jest.fn());

      expect(result.success).toBe(false);
      expect(result.message).toContain('file is too small');
    });

    test('should succeed on valid flow: download -> extract -> dependency -> finalize', async () => {
      mockDownload.mockResolvedValue('/temp/nes.zip');

      (fs.statSync as jest.Mock).mockReturnValue({ size: 5000000 });
      (fs.readdirSync as jest.Mock).mockReturnValue(['Mesen.exe']);
      
      mockResolveBinary.mockResolvedValue('/engines/nes/Mesen.exe');

      const result = await EngineService.installEngine('nes', jest.fn());

      expect(result.success).toBe(true);
      expect(osHandler.extractArchive).toHaveBeenCalled();
      expect(osHandler.finalizeInstall).toHaveBeenCalledWith('/engines/nes/Mesen.exe', true);
    });

    test('should handle Nested Archives (e.g. zip inside zip)', async () => {
      mockDownload.mockResolvedValue('/temp/outer.zip');
      (fs.statSync as jest.Mock).mockReturnValue({ size: 5000000 });
      
      (fs.readdirSync as jest.Mock).mockReturnValue(['inner.zip', 'readme.txt']);
      
      await EngineService.installEngine('nes', jest.fn());

      expect(osHandler.extractArchive).toHaveBeenCalledTimes(2);
    });
  });

  describe('installBios', () => {
    test('should install BIOS from raw file if name matches', async () => {
      const sourcePath = '/downloads/bios7.bin';
      const result = await EngineService.installBios('ds', sourcePath);

      expect(result.success).toBe(true);
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    test('should throw error if raw file name does not match required bios', async () => {
      const sourcePath = '/downloads/wrong_name.bin';
      
      await expect(() => EngineService.installBios('ds', sourcePath))
        .toThrow("not a valid BIOS");
    });

    test('should extract specific BIOS files from a ZIP', async () => {
      const sourcePath = '/downloads/bios_pack.zip';
      const consoleId = 'ds'; 


      const mockEntries = [
        { 
          name: 'bios7.bin',
          entryName: 'bios7.bin',
          getData: jest.fn().mockReturnValue(Buffer.from('valid-bios-data')),
          isDirectory: false
        },
        { 
          name: 'garbage.txt',
          entryName: 'garbage.txt',
          getData: jest.fn().mockReturnValue(Buffer.from('garbage-data')),
          isDirectory: false
        },
      ];

      (AdmZip as unknown as jest.Mock).mockImplementationOnce(() => ({
         getEntries: jest.fn().mockReturnValue(mockEntries),
      }));

      const result = await EngineService.installBios(consoleId, sourcePath);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('bios7.bin'),
        Buffer.from('valid-bios-data')
      );
    });
  });
});