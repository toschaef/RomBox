import fs from 'fs';
import path from 'path';
import { BaseConfigurator } from '../../../src/main/utils/configurators/BaseConfigurator';
import { IniEditor } from '../../../src/main/utils/editors/ini';
import type { EmulatorPatch } from '../../../src/main/utils/translators/ITranslator';

class TestConfigurator extends BaseConfigurator {
  public async configure(): Promise<void> {}

  public testSetIniValue(filePath: string, section: string, key: string, value: string) {
    this.setIniValue(filePath, section, key, value);
  }

  public testApplyPatches(patches: EmulatorPatch[]) {
    this.applyPatches(patches);
  }

  public testPatchesToIniUpdates(patches: EmulatorPatch[]) {
    return this.patchesToIniUpdates(patches);
  }

  public testFindBiosFile(biosDir: string, validBiosNames: string[] = []) {
    return this.findBiosFile(biosDir, validBiosNames);
  }
}

describe('BaseConfigurator Empirical Stress Tests', () => {
  const tempDir = path.resolve(__dirname, '../../temp-baseconfigurator-empirical');
  const testIniFile = path.join(tempDir, 'test.ini');

  let configurator: TestConfigurator;

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    configurator = new TestConfigurator();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('setIniValue Edge Cases', () => {
    it('handles out-of-section key conflicts properly', () => {
      const iniContent = `[Display]\nVolume = 10\n\n[Audio]\nVolume = 50\n`;
      fs.writeFileSync(testIniFile, iniContent, 'utf-8');

      configurator.testSetIniValue(testIniFile, 'Audio', 'Volume', '100');

      const updated = fs.readFileSync(testIniFile, 'utf-8');
      expect(updated).toContain('[Display]\nVolume = 10');
      expect(updated).toContain('[Audio]\nVolume = 100');
    });

    it('tests whitespace variations around `=` in existing file', () => {
      const iniContent = [
        '[Audio]',
        'KeySpaced = 1',
        'KeyCompact=2',
        'KeyMultiSpace   =   3',
        'KeyTabs\t=\t4',
        'KeySpaceAfter= 5',
        'KeySpaceBefore =6',
      ].join('\n');
      fs.writeFileSync(testIniFile, iniContent, 'utf-8');

      configurator.testSetIniValue(testIniFile, 'Audio', 'KeySpaced', '100');
      configurator.testSetIniValue(testIniFile, 'Audio', 'KeyCompact', '200');
      configurator.testSetIniValue(testIniFile, 'Audio', 'KeyMultiSpace', '300');
      configurator.testSetIniValue(testIniFile, 'Audio', 'KeyTabs', '400');
      configurator.testSetIniValue(testIniFile, 'Audio', 'KeySpaceAfter', '500');
      configurator.testSetIniValue(testIniFile, 'Audio', 'KeySpaceBefore', '600');

      const updated = fs.readFileSync(testIniFile, 'utf-8');
      expect(updated).toContain('KeySpaced = 100');
      expect(updated).toContain('KeyCompact = 200');
      expect(updated).toContain('KeySpaceAfter = 500');
      expect(updated).toContain('KeySpaceBefore = 600');
      
      // Multi-space and Tabs now match with the regex ^\s*${key}\s*=
      expect(updated).toContain('KeyMultiSpace = 300');
      expect(updated).toContain('KeyTabs = 400');
    });

    it('does NOT create missing keys or missing sections', () => {
      const iniContent = `[Audio]\nExistingKey = 1\n`;
      fs.writeFileSync(testIniFile, iniContent, 'utf-8');

      configurator.testSetIniValue(testIniFile, 'Audio', 'MissingKey', '100');
      configurator.testSetIniValue(testIniFile, 'MissingSection', 'Key', '200');

      const updated = fs.readFileSync(testIniFile, 'utf-8');
      expect(updated).not.toContain('MissingKey');
      expect(updated).not.toContain('MissingSection');
    });

    it('fails to match section header with trailing comments or spaces', () => {
      const iniContent = `[Audio] # audio section\nVolume = 50\n`;
      fs.writeFileSync(testIniFile, iniContent, 'utf-8');

      configurator.testSetIniValue(testIniFile, 'Audio', 'Volume', '100');

      const updated = fs.readFileSync(testIniFile, 'utf-8');
      expect(updated).toContain('Volume = 50'); // Untouched due to endsWith(']') check
    });

    it('cannot modify root section keys', () => {
      const iniContent = `GlobalKey = 1\n\n[Audio]\nVolume = 50\n`;
      fs.writeFileSync(testIniFile, iniContent, 'utf-8');

      configurator.testSetIniValue(testIniFile, '', 'GlobalKey', '100');

      const updated = fs.readFileSync(testIniFile, 'utf-8');
      expect(updated).toContain('GlobalKey = 1'); // Untouched because inSection starts as false
    });
  });

  describe('applyPatches & IniEditor Behavior', () => {
    it('applies ini-set, file-write, and ini-delete patches', () => {
      const iniContent = `[Audio]\nVolume = 50\nMute = false\n`;
      fs.writeFileSync(testIniFile, iniContent, 'utf-8');
      const writtenFile = path.join(tempDir, 'sub/file.txt');

      const patches: EmulatorPatch[] = [
        { kind: 'ini-set', absPath: testIniFile, section: 'Audio', key: 'Volume', value: '80' },
        { kind: 'ini-set', absPath: testIniFile, section: 'Display', key: 'FPS', value: '60' },
        { kind: 'ini-delete', absPath: testIniFile, section: 'Audio', key: 'Mute' },
        { kind: 'file-write', absPath: writtenFile, contents: 'hello world' },
        { kind: 'ini-set', absPath: '', section: 'Audio', key: 'Ignored', value: '1' },
      ];

      configurator.testApplyPatches(patches);

      const updatedIni = fs.readFileSync(testIniFile, 'utf-8');
      expect(updatedIni).toContain('Volume = 80');
      expect(updatedIni).toContain('[Display]');
      expect(updatedIni).toContain('FPS = 60');
      expect(updatedIni).not.toContain('Mute');

      expect(fs.existsSync(writtenFile)).toBe(true);
      expect(fs.readFileSync(writtenFile, 'utf-8')).toBe('hello world');
    });

    it('places root section updates at the end of file, putting them under the last section', () => {
      const iniContent = `[Audio]\nVolume = 50\n`;
      fs.writeFileSync(testIniFile, iniContent, 'utf-8');

      const patches: EmulatorPatch[] = [
        { kind: 'ini-set', absPath: testIniFile, section: '', key: 'GlobalSetting', value: 'true' },
      ];

      configurator.testApplyPatches(patches);

      const updatedIni = fs.readFileSync(testIniFile, 'utf-8');
      // Notice GlobalSetting is appended after [Audio], effectively putting it inside [Audio] section!
      const lines = updatedIni.split('\n');
      const audioIdx = lines.findIndex(l => l.trim() === '[Audio]');
      const globalIdx = lines.findIndex(l => l.includes('GlobalSetting'));
      expect(globalIdx).toBeGreaterThan(audioIdx);
    });
  });

  describe('patchesToIniUpdates Helper', () => {
    it('aggregates ini-set patches and handles section whitespace trimming and defaults', () => {
      const patches: EmulatorPatch[] = [
        { kind: 'ini-set', section: ' Audio ', key: 'Volume', value: '50' },
        { kind: 'ini-set', section: undefined as unknown as string, key: 'GlobalVal', value: 'true' }, // section undefined
        { kind: 'ini-set', section: 'Audio', key: 'Volume', value: '80' }, // overwrite
        { kind: 'file-write', absPath: '/tmp/test', contents: 'test' }, // ignored
        { kind: 'ini-delete', absPath: '/tmp/test', section: 'Audio', key: 'Volume' }, // ignored
      ];

      const updates = configurator.testPatchesToIniUpdates(patches);

      expect(updates).toEqual({
        Audio: { Volume: '80' },
        '': { GlobalVal: 'true' },
      });
    });
  });

  describe('findBiosFile Helper', () => {
    it('returns exact match from validBiosNames if present', () => {
      const biosDir = path.join(tempDir, 'bios');
      fs.mkdirSync(biosDir, { recursive: true });
      fs.writeFileSync(path.join(biosDir, 'scph5501.bin'), 'data');
      fs.writeFileSync(path.join(biosDir, 'scph1001.bin'), 'data');

      const result = configurator.testFindBiosFile(biosDir, ['scph1001.bin', 'scph5501.bin']);
      expect(result).toBe('scph1001.bin');
    });

    it('falls back to directory search if validBiosNames fails or is empty', () => {
      const biosDir = path.join(tempDir, 'bios');
      fs.mkdirSync(biosDir, { recursive: true });
      fs.writeFileSync(path.join(biosDir, 'custom_bios.bin'), 'data');

      const result = configurator.testFindBiosFile(biosDir, ['missing.bin']);
      expect(result).toBe('custom_bios.bin');
    });

    it('returns null if biosDir does not exist or has no matching files', () => {
      const resultNonExistent = configurator.testFindBiosFile(path.join(tempDir, 'nonexistent'));
      expect(resultNonExistent).toBeNull();

      const biosDir = path.join(tempDir, 'emptybios');
      fs.mkdirSync(biosDir, { recursive: true });
      fs.writeFileSync(path.join(biosDir, 'readme.txt'), 'data');

      const resultEmpty = configurator.testFindBiosFile(biosDir);
      expect(resultEmpty).toBeNull();
    });

    it('ignores directories matching bios pattern in fallback search', () => {
      const biosDir = path.join(tempDir, 'bios_dir_test');
      fs.mkdirSync(biosDir, { recursive: true });
      // Create a DIRECTORY named bios.bin
      fs.mkdirSync(path.join(biosDir, 'fake_bios.bin'));

      const result = configurator.testFindBiosFile(biosDir);
      // findBiosFile checks isFile() and ignores directories
      expect(result).toBeNull();
    });
  });
});
