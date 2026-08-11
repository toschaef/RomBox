import fs from 'fs';
import path from 'path';
import { findPlayStationBios } from '../../../../src/main/emulators/playstationBios';

describe('PlayStation BIOS discovery', () => {
  const tempDir = path.resolve(__dirname, '../../../temp-playstation-bios');

  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('findPlayStationBios', () => {
    it('returns exact match from validBiosNames if present', () => {
      const biosDir = path.join(tempDir, 'bios');
      fs.mkdirSync(biosDir, { recursive: true });
      fs.writeFileSync(path.join(biosDir, 'scph5501.bin'), 'data');
      fs.writeFileSync(path.join(biosDir, 'scph1001.bin'), 'data');

      const result = findPlayStationBios(biosDir, ['scph1001.bin', 'scph5501.bin']);
      expect(result).toBe('scph1001.bin');
    });

    it('falls back to directory search if validBiosNames fails or is empty', () => {
      const biosDir = path.join(tempDir, 'bios');
      fs.mkdirSync(biosDir, { recursive: true });
      fs.writeFileSync(path.join(biosDir, 'custom_bios.bin'), 'data');

      const result = findPlayStationBios(biosDir, ['missing.bin']);
      expect(result).toBe('custom_bios.bin');
    });

    it('returns null if biosDir does not exist or has no matching files', () => {
      const resultNonExistent = findPlayStationBios(path.join(tempDir, 'nonexistent'));
      expect(resultNonExistent).toBeNull();

      const biosDir = path.join(tempDir, 'emptybios');
      fs.mkdirSync(biosDir, { recursive: true });
      fs.writeFileSync(path.join(biosDir, 'readme.txt'), 'data');

      const resultEmpty = findPlayStationBios(biosDir);
      expect(resultEmpty).toBeNull();
    });

    it('ignores directories matching bios pattern in fallback search', () => {
      const biosDir = path.join(tempDir, 'bios_dir_test');
      fs.mkdirSync(biosDir, { recursive: true });
      // create a DIRECTORY named bios.bin
      fs.mkdirSync(path.join(biosDir, 'fake_bios.bin'));

      const result = findPlayStationBios(biosDir);
      // findPlayStationBios checks isFile() and ignores directories
      expect(result).toBeNull();
    });
  });
});
