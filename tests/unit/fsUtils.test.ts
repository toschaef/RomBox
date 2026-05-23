import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { findFile, scanZipEntries, extractZipEntry } from '../../src/main/utils/fsUtils';

describe('fsUtils helper suite', () => {
  const testDir = path.resolve(__dirname, '../temp-fsutils-tests');

  beforeAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (err) {
      // ignore
    }
  });

  describe('findFile', () => {
    const findDir = path.join(testDir, 'find-file-suite');

    beforeAll(() => {
      fs.mkdirSync(findDir, { recursive: true });
      fs.mkdirSync(path.join(findDir, 'subdir1'), { recursive: true });
      fs.mkdirSync(path.join(findDir, 'subdir1/nested'), { recursive: true });
      fs.mkdirSync(path.join(findDir, 'subdir2'), { recursive: true });

      fs.writeFileSync(path.join(findDir, 'root.txt'), 'root');
      fs.writeFileSync(path.join(findDir, 'subdir1/level1.txt'), 'level1');
      fs.writeFileSync(path.join(findDir, 'subdir1/nested/level2.txt'), 'level2');
    });

    it('should find a file in the root directory', () => {
      const result = findFile(findDir, 'root.txt');
      expect(result).toBe(path.join(findDir, 'root.txt'));
    });

    it('should find a file nested in subdirectories recursively', () => {
      const result1 = findFile(findDir, 'level1.txt');
      expect(result1).toBe(path.join(findDir, 'subdir1/level1.txt'));

      const result2 = findFile(findDir, 'level2.txt');
      expect(result2).toBe(path.join(findDir, 'subdir1/nested/level2.txt'));
    });

    it('should return null if file is not found', () => {
      const result = findFile(findDir, 'ghost.txt');
      expect(result).toBeNull();
    });

    it('should handle errors and return null for invalid directory paths', () => {
      const result = findFile(path.join(findDir, 'ghost-folder'), 'ghost.txt');
      expect(result).toBeNull();
    });
  });

  describe('ZIP archive operations', () => {
    const zipFilePath = path.join(testDir, 'test-archive.zip');
    const extractDestPath = path.join(testDir, 'extracted-entry.txt');

    beforeAll(() => {
      // Programmatically create a valid ZIP file for testing using adm-zip
      const zip = new AdmZip();
      zip.addFile('hello.txt', Buffer.from('Hello Zip World!'), 'test comment');
      zip.addFile('folder/', Buffer.alloc(0)); // directory entry
      zip.addFile('folder/nested.txt', Buffer.from('Nested in zip'), '');
      zip.writeZip(zipFilePath);
    });

    afterEach(() => {
      if (fs.existsSync(extractDestPath)) {
        fs.unlinkSync(extractDestPath);
      }
    });

    it('should list only file entries in ZIP archives', async () => {
      const entries = await scanZipEntries(zipFilePath);
      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual({
        fileName: 'hello.txt',
        uncompressedSize: 16
      });
      expect(entries).toContainEqual({
        fileName: 'folder/nested.txt',
        uncompressedSize: 13
      });
    });

    it('should extract a specific ZIP file entry successfully', async () => {
      await extractZipEntry(zipFilePath, 'hello.txt', extractDestPath);
      expect(fs.existsSync(extractDestPath)).toBe(true);
      const content = fs.readFileSync(extractDestPath, 'utf8');
      expect(content).toBe('Hello Zip World!');
    });

    it('should reject with an error if requested entry does not exist', async () => {
      await expect(extractZipEntry(zipFilePath, 'missing.txt', extractDestPath))
        .rejects.toThrow('Entry "missing.txt" not found in zip.');
    });

    it('should reject with an error for invalid zip file paths', async () => {
      await expect(scanZipEntries(path.join(testDir, 'missing.zip')))
        .rejects.toThrow();
    });
  });
});
