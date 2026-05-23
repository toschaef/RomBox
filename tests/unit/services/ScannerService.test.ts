import fs from "fs";
import path from "path";
import { ScannerService } from "../../../src/main/services/ScannerService";
import { Extractor } from "../../../src/main/utils/extractor";
import { scanZipEntries } from "../../../src/main/utils/fsUtils";
import { detectConsoleFromHeader } from "../../../src/main/utils/identifier";
import { BiosService } from "../../../src/main/services/BiosService";
import { app } from "electron";

jest.mock("../../../src/main/utils/extractor", () => ({
  Extractor: {
    list7z: jest.fn(),
    extract7z: jest.fn(),
    extractToFile: jest.fn(),
  }
}));

jest.mock("../../../src/main/utils/fsUtils", () => ({
  scanZipEntries: jest.fn(),
}));

jest.mock("../../../src/main/utils/identifier", () => ({
  detectConsoleFromHeader: jest.fn(),
}));

jest.mock("../../../src/main/services/BiosService", () => ({
  BiosService: {
    installBios: jest.fn().mockResolvedValue({ success: true, installed: ["mock_installed"] }),
  }
}));

describe("ScannerService", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");

  beforeEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
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
  });

  describe("importGame", () => {
    it("should import normal game file", async () => {
      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "nes",
        engineId: "mesen",
        filePath: "/mock/src/game.nes"
      });

      expect(result.title).toBe("game");
      expect(result.consoleId).toBe("nes");
      expect(Extractor.extractToFile).toHaveBeenCalled();
    });

    it("should import directory game for PS1/PS2", async () => {
      const gameDir = path.join(tempDir, "GameDir");
      fs.mkdirSync(gameDir);
      fs.writeFileSync(path.join(gameDir, "file.bin"), "bin content");

      const result = await ScannerService.importGame({
        type: "game",
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: gameDir
      });

      expect(result.title).toBe("GameDir");
      expect(result.consoleId).toBe("ps1");
      expect(fs.existsSync(result.filePath)).toBe(true);
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
