import fs from 'fs';
import path from 'path';
import { BaseConfigurator } from '../../../../src/main/emulators/BaseConfigurator';
import type { EmulatorPatch } from '../../../../src/main/emulators/translatorTypes';

class TestConfigurator extends BaseConfigurator {
  public async configure(): Promise<void> {
    // No-op for testing
  }

  public testApplyPatches(patches: EmulatorPatch[]) {
    this.applyPatches(patches);
  }

  public testPatchesToIniUpdates(patches: EmulatorPatch[]) {
    return this.patchesToIniUpdates(patches);
  }

}

describe('BaseConfigurator Empirical Stress Tests', () => {
  const tempDir = path.resolve(__dirname, '../../../temp-baseconfigurator-empirical');
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
});
