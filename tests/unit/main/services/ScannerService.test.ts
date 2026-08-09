import { suiteUserDataDir } from "../../../helpers/tempDirs";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { ScannerService } from "../../../../src/main/services/ScannerService";
import { Extractor } from "../../../../src/main/utils/extractor";
import { scanZipEntries, readZipEntryHeader } from "../../../../src/main/utils/fsUtils";
import { detectConsoleFromHeader } from "../../../../src/main/utils/identifier";
import { BiosService } from "../../../../src/main/services/BiosService";

jest.mock("../../../../src/main/utils/extractor", () => ({
  Extractor: {
    list7z: jest.fn(),
    extract7z: jest.fn(),
    extractToFile: jest.fn(),
  }
}));

jest.mock("adm-zip");

jest.mock("../../../../src/main/utils/fsUtils", () => ({
  scanZipEntries: jest.fn(),
  readZipEntryHeader: jest.fn(),
}));

// Keep the real PS1/PS2 SYSTEM.CNF + cue-geometry detection (that's what
// these tests exercise) and only mock the file-header-based path, which
// several other tests drive directly via detectConsoleFromHeader.
jest.mock("../../../../src/main/utils/identifier", () => ({
  ...jest.requireActual("../../../../src/main/utils/identifier"),
  detectConsoleFromHeader: jest.fn(),
}));

// Builds a raw CD-sector-aligned (e.g. MODE2/2352) buffer containing a
// minimal ISO9660 filesystem with a SYSTEM.CNF at the root, matching what
// detectPS1orPS2FromISO9660/detectPS1orPS2FromBuffer walk via `geometry`.
function buildRawIso9660WithSystemCnf(geometry: { stride: number; dataOffset: number }, systemCnfContent: string): Buffer {
  const LOGICAL = 2048;
  const physicalOffsetForLba = (lba: number) => lba * geometry.stride + geometry.dataOffset;

  const rootDirLba = 20;
  const sysCnfLba = 21;
  const buffer = Buffer.alloc(Math.max(24 * geometry.stride, physicalOffsetForLba(sysCnfLba) + LOGICAL));

  const pvdPhysical = physicalOffsetForLba(16);
  buffer.write('CD001', pvdPhysical + 1, 'ascii');
  buffer[pvdPhysical] = 1;

  const rootRecordOffset = pvdPhysical + 156;
  buffer[rootRecordOffset] = 34;
  buffer.writeUInt32LE(rootDirLba, rootRecordOffset + 2);
  buffer.writeUInt32LE(LOGICAL, rootRecordOffset + 10);

  const rootDirPhysical = physicalOffsetForLba(rootDirLba);
  const fileId = 'SYSTEM.CNF';
  buffer[rootDirPhysical] = 44;
  buffer.writeUInt32LE(sysCnfLba, rootDirPhysical + 2);
  buffer.writeUInt32LE(Buffer.byteLength(systemCnfContent), rootDirPhysical + 10);
  buffer[rootDirPhysical + 32] = fileId.length;
  buffer.write(fileId, rootDirPhysical + 33, 'ascii');

  buffer.write(systemCnfContent, physicalOffsetForLba(sysCnfLba), 'ascii');

  return buffer;
}

const MODE2_2352 = { stride: 2352, dataOffset: 24 };
const PLAIN_ISO_GEOMETRY = { stride: 2048, dataOffset: 0 };

jest.mock("../../../../src/main/services/BiosService", () => ({
  BiosService: {
    installBios: jest.fn().mockResolvedValue({ success: true, installed: ["mock_installed"] }),
  }
}));

describe("ScannerService", () => {
  const tempDir = suiteUserDataDir();

  beforeEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      } catch {
        // ignore locked dir
      }
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      } catch {
        // ignore locked dir
      }
    }
  });

  describe("scanPath", () => {
    it("should return empty array for ignored folders (starts with dot or node_modules)", async () => {
      const dotDir = path.join(tempDir, ".hidden");
      fs.mkdirSync(dotDir);
      const results = await ScannerService.scanPath(dotDir);
      expect(results).toEqual([]);
    });

    it("should detect 3ds bios if it is an Azahar user root directory", async () => {
      const userDir = path.join(tempDir, "user");
      fs.mkdirSync(userDir);
      fs.mkdirSync(path.join(userDir, "nand"));

      const results = await ScannerService.scanPath(userDir);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: "bios",
        consoleId: "3ds",
        engineId: "azahar",
        filePath: userDir,
      });
    });

    it("should detect ps1 game if directory contains a cue file", async () => {
      const ps1Dir = path.join(tempDir, "MyPS1Game");
      fs.mkdirSync(ps1Dir);
      fs.writeFileSync(path.join(ps1Dir, "game.cue"), "cue content");

      const results = await ScannerService.scanPath(ps1Dir);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: "game",
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: ps1Dir,
      });
    });

    it("should detect a small PS2 game in a cue/bin directory via SYSTEM.CNF's BOOT2 marker, not just default to ps1", async () => {
      const ps2Dir = path.join(tempDir, "MyPS2Game");
      fs.mkdirSync(ps2Dir);
      fs.writeFileSync(path.join(ps2Dir, "game.cue"), 'FILE "game.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n');
      fs.writeFileSync(path.join(ps2Dir, "game.bin"), buildRawIso9660WithSystemCnf(MODE2_2352, "BOOT2 = cdrom0:\\SLUS_200.01;1\r\n"));

      const results = await ScannerService.scanPath(ps2Dir);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: "game",
        consoleId: "ps2",
        engineId: "pcsx2",
        filePath: ps2Dir,
      });
    });

    it("should detect a PS1 game in a cue/bin directory via SYSTEM.CNF's BOOT marker", async () => {
      const ps1Dir = path.join(tempDir, "MyRealPS1Game");
      fs.mkdirSync(ps1Dir);
      fs.writeFileSync(path.join(ps1Dir, "game.cue"), 'FILE "game.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n');
      fs.writeFileSync(path.join(ps1Dir, "game.bin"), buildRawIso9660WithSystemCnf(MODE2_2352, "BOOT = cdrom:\\SLUS_005.01;1\r\n"));

      const results = await ScannerService.scanPath(ps1Dir);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: "game",
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: ps1Dir,
      });
    });

    it("should scan directory recursively", async () => {
      const subDir = path.join(tempDir, "sub");
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, "game.nes"), "nes content");

      const results = await ScannerService.scanPath(tempDir);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("game");
      expect(results[0].consoleId).toBe("nes");
    });
  });

  describe("scanFile", () => {
    it("should identify a BIOS file by filename", async () => {
      const biosFile = path.join(tempDir, "scph1001.bin");
      fs.writeFileSync(biosFile, "dummy bios");

      const results = await ScannerService.scanFile(biosFile);
      expect(results).toEqual([{
        type: "bios",
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: biosFile,
      }]);
    });

    it("should scan zip archive and detect nested BIOS or games", async () => {
      const zipFile = path.join(tempDir, "archive.zip");
      fs.writeFileSync(zipFile, "dummy zip");

      (scanZipEntries as jest.Mock).mockResolvedValue([
        { fileName: "scph1001.bin", uncompressedSize: 512 },
        { fileName: "game.nes", uncompressedSize: 1024 }
      ]);

      const results = await ScannerService.scanFile(zipFile);
      expect(results).toContainEqual({
        type: "bios",
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: zipFile,
        zipEntryName: "scph1001.bin"
      });
      expect(results).toContainEqual({
        type: "game",
        consoleId: "nes",
        engineId: "mesen",
        filePath: zipFile,
        zipEntryName: "game.nes"
      });
    });

    it("should detect 3ds user root in zip file", async () => {
      const zipFile = path.join(tempDir, "archive.zip");
      fs.writeFileSync(zipFile, "dummy zip");

      (scanZipEntries as jest.Mock).mockResolvedValue([
        { fileName: "user/nand/something", uncompressedSize: 512 }
      ]);

      const results = await ScannerService.scanFile(zipFile);
      expect(results).toEqual([{
        type: "bios",
        consoleId: "3ds",
        engineId: "azahar",
        filePath: zipFile,
        zipEntryName: "user"
      }]);
    });

    it("should detect multi-file game (cue/bin) in archive", async () => {
      const zipFile = path.join(tempDir, "game.zip");
      fs.writeFileSync(zipFile, "dummy zip");

      (scanZipEntries as jest.Mock).mockResolvedValue([
        { fileName: "game.cue", uncompressedSize: 200 },
        { fileName: "game.bin", uncompressedSize: 900 * 1024 * 1024 } // large bin triggers ps2
      ]);

      const results = await ScannerService.scanFile(zipFile);
      expect(results).toEqual([{
        type: "game",
        consoleId: "ps2",
        engineId: "pcsx2",
        filePath: zipFile,
        zipEntryName: "game.cue",
        isMultiFile: true,
      }]);
    });

    it("should detect a small PS2 game in a zipped cue/bin via SYSTEM.CNF's BOOT2 marker, not just fall back to size", async () => {
      const zipFile = path.join(tempDir, "smallGame.zip");
      fs.writeFileSync(zipFile, "dummy zip");

      (scanZipEntries as jest.Mock).mockResolvedValue([
        { fileName: "game.cue", uncompressedSize: 200 },
        { fileName: "game.bin", uncompressedSize: 400 * 1024 * 1024 } // small bin - would default to ps1 under the old size heuristic
      ]);

      (readZipEntryHeader as jest.Mock).mockImplementation(async (_archivePath: string, entryName: string) => {
        if (entryName === "game.cue") {
          return Buffer.from('FILE "game.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n', 'utf-8');
        }
        return buildRawIso9660WithSystemCnf(MODE2_2352, "BOOT2 = cdrom0:\\SLUS_200.01;1\r\n");
      });

      const results = await ScannerService.scanFile(zipFile);
      expect(results).toEqual([{
        type: "game",
        consoleId: "ps2",
        engineId: "pcsx2",
        filePath: zipFile,
        zipEntryName: "game.cue",
        isMultiFile: true,
      }]);
    });

    it("should fallback to header-based detection for .iso files", async () => {
      const isoFile = path.join(tempDir, "game.iso");
      fs.writeFileSync(isoFile, "dummy iso");

      (detectConsoleFromHeader as jest.Mock).mockResolvedValue("ps2");

      const results = await ScannerService.scanFile(isoFile);
      expect(results).toEqual([{
        type: "game",
        consoleId: "ps2",
        engineId: "pcsx2",
        filePath: isoFile,
      }]);
    });

    it("should detect a small PS2 game in a zipped single .iso (no .cue) via SYSTEM.CNF, not misclassify by size", async () => {
      const zipFile = path.join(tempDir, "singleIso.zip");
      fs.writeFileSync(zipFile, "dummy zip");

      // Under the old size-only heuristic for zip entries (no filePathForHeader
      // available), this would have been misclassified as ps1 (>50MB, <800MB)
      // or gone unidentified entirely.
      (scanZipEntries as jest.Mock).mockResolvedValue([
        { fileName: "game.iso", uncompressedSize: 400 * 1024 * 1024 }
      ]);

      (readZipEntryHeader as jest.Mock).mockResolvedValue(
        buildRawIso9660WithSystemCnf(PLAIN_ISO_GEOMETRY, "BOOT2 = cdrom0:\\SLUS_200.01;1\r\n")
      );

      const results = await ScannerService.scanFile(zipFile);
      expect(results).toEqual([{
        type: "game",
        consoleId: "ps2",
        engineId: "pcsx2",
        filePath: zipFile,
        zipEntryName: "game.iso",
      }]);
    });
  });

  describe("importGame", () => {
    it("should reference a normal game file in place instead of copying it", async () => {
      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "nes",
        engineId: "mesen",
        filePath: "/mock/src/game.nes"
      });

      expect(result.title).toBe("game");
      expect(result.consoleId).toBe("nes");
      // duplicating roms is what fills the user's disk - the library records
      // where the file already lives
      expect(result.filePath).toBe("/mock/src/game.nes");
      expect(Extractor.extractToFile).not.toHaveBeenCalled();
    });

    it("should still extract an entry out of an archive", async () => {
      // no emulator can be handed a path inside a .zip, so this one copy stays
      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "nes",
        engineId: "mesen",
        filePath: "/mock/src/pack.zip",
        zipEntryName: "game.nes"
      });

      expect(result.filePath).toBe(path.join(suiteUserDataDir(), "roms", "nes", "game.nes"));
      expect(Extractor.extractToFile).toHaveBeenCalled();
    });

    it("should reference a game directory in place", async () => {
      const gameDir = path.join(tempDir, "InPlaceDir");
      fs.mkdirSync(gameDir);
      fs.writeFileSync(path.join(gameDir, "file.bin"), "bin content");
      fs.writeFileSync(path.join(gameDir, "game.cue"), "cue content");

      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: gameDir
      });

      expect(result.filePath).toBe(path.join(gameDir, "game.cue"));
    });

    it("should import directory game for PS1/PS2, pointing filePath at the .cue file (not the directory)", async () => {
      const gameDir = path.join(tempDir, "GameDir");
      fs.mkdirSync(gameDir);
      fs.writeFileSync(path.join(gameDir, "file.bin"), "bin content");
      fs.writeFileSync(path.join(gameDir, "game.cue"), "cue content");

      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: gameDir
      });

      expect(result.title).toBe("GameDir");
      expect(result.consoleId).toBe("ps1");
      // The launch command is handed result.filePath directly, so it must
      // resolve to the actual disc image entrypoint, not the containing
      // directory - a directory isn't a file PCSX2/DuckStation can open.
      expect(fs.statSync(result.filePath).isFile()).toBe(true);
      expect(path.basename(result.filePath)).toBe("game.cue");
      expect(fs.existsSync(result.filePath)).toBe(true);
    });

    it("should point PS2 directory imports at the .bin, not the .cue (PCSX2 fails to open some valid .cue sheets but opens the .bin directly)", async () => {
      const gameDir = path.join(tempDir, "PS2GameDir");
      fs.mkdirSync(gameDir);
      fs.writeFileSync(path.join(gameDir, "game.bin"), "bin content");
      fs.writeFileSync(path.join(gameDir, "game.cue"), "cue content");

      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "ps2",
        engineId: "pcsx2",
        filePath: gameDir
      });

      expect(path.basename(result.filePath)).toBe("game.bin");
      expect(fs.existsSync(result.filePath)).toBe(true);
    });

    it("should keep using the .cue for PS2 directory imports with multiple data files (can't collapse to a single entrypoint)", async () => {
      const gameDir = path.join(tempDir, "PS2MultiBinDir");
      fs.mkdirSync(gameDir);
      fs.writeFileSync(path.join(gameDir, "game (Track 1).bin"), "bin content 1");
      fs.writeFileSync(path.join(gameDir, "game (Track 2).bin"), "bin content 2");
      fs.writeFileSync(path.join(gameDir, "game.cue"), "cue content");

      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "ps2",
        engineId: "pcsx2",
        filePath: gameDir
      });

      expect(path.basename(result.filePath)).toBe("game.cue");
    });

    it("should point PS2 multi-file archive imports at the .bin, not the .cue", async () => {
      const zipFile = path.join(tempDir, "ps2archive.zip");
      (AdmZip as unknown as jest.Mock).mockImplementation(() => ({
        extractAllTo: (dest: string) => {
          fs.mkdirSync(dest, { recursive: true });
          fs.writeFileSync(path.join(dest, "game.bin"), "bin content");
          fs.writeFileSync(path.join(dest, "game.cue"), "cue content");
        }
      }));

      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "ps2",
        engineId: "pcsx2",
        filePath: zipFile,
        zipEntryName: "game.cue",
        isMultiFile: true,
      });

      expect(path.basename(result.filePath)).toBe("game.bin");
    });
  });

  describe("importBios", () => {
    it("should delegate to BiosService for normal files", async () => {
      const res = await ScannerService.importBios({
        type: "bios",
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: "/path/to/bios.bin"
      });

      expect(BiosService.installBios).toHaveBeenCalledWith("ps1", "/path/to/bios.bin");
      expect(res).toEqual({ success: true, installed: ["mock_installed"] });
    });
  });
});
