import { Extractor } from "../../src/main/utils/extractor";
import { spawn } from "child_process";
import fs from "fs";
import AdmZip from "adm-zip";

jest.mock("child_process", () => ({
  spawn: jest.fn()
}));

jest.mock("adm-zip", () => {
  return jest.fn().mockImplementation(() => ({
    extractAllTo: jest.fn()
  }));
});

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: jest.fn().mockResolvedValue(undefined),
      copyFile: jest.fn().mockResolvedValue(undefined),
      cp: jest.fn().mockResolvedValue(undefined),
      rename: jest.fn().mockResolvedValue(undefined),
      rm: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({
        isDirectory: () => false,
        size: 100
      })
    },
    existsSync: jest.fn().mockReturnValue(true)
  };
});

describe("Extractor", () => {
  const mockSpawn = spawn as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("extractToFile", () => {
    it("should resolve directly if zipEntryName is not provided and source equals dest", async () => {
      await Extractor.extractToFile("/path/rom.nes", "/path/rom.nes");
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });

    it("should copy file if zipEntryName is not provided and source does not equal dest", async () => {
      await Extractor.extractToFile("/path/source.nes", "/path/dest.nes");
      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.copyFile).toHaveBeenCalledWith("/path/source.nes", "/path/dest.nes");
    });
  });

  describe("extract7z", () => {
    it("should spawn 7zip process with correct extraction arguments", async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === "close") {
            // Simulate successful process completion
            setTimeout(() => callback(0), 10);
          }
        })
      };

      mockSpawn.mockReturnValue(mockChild);

      await Extractor.extract7z("/path/archive.7z", "/path/out", "game.nes");

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ["x", "/path/archive.7z", "-o/path/out", "-y", "game.nes"]
      );
    });

    it("should reject if 7zip exits with non-zero code", async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn().mockImplementation((event, callback) => {
          if (event === "data") callback(Buffer.from("Error message"));
        }) },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(1), 10);
          }
        })
      };

      mockSpawn.mockReturnValue(mockChild);

      await expect(
        Extractor.extract7z("/path/archive.7z", "/path/out", "game.nes")
      ).rejects.toThrow("7-Zip exited with code 1");
    });
  });

  describe("list7z", () => {
    it("should parse 7zip -slt output correctly", async () => {
      const sampleSltOutput = `
Path = game.nes
Size = 40960
Attributes = A
`;

      const mockChild = {
        stdout: { on: jest.fn().mockImplementation((event, callback) => {
          if (event === "data") callback(Buffer.from(sampleSltOutput));
        }) },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      mockSpawn.mockReturnValue(mockChild);

      const entries = await Extractor.list7z("/path/archive.7z");

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ["l", "/path/archive.7z", "-slt"]
      );

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        file: "game.nes",
        size: "40960",
        attr: "A"
      });
    });
  });

  describe("extractArchive", () => {
    it("should extract zip archive using AdmZip", async () => {
      const mockExtractAllTo = jest.fn();
      (AdmZip as unknown as jest.Mock).mockImplementation(() => ({
        extractAllTo: mockExtractAllTo
      }));

      await Extractor.extractArchive("/path/file.zip", "/path/out");
      expect(AdmZip).toHaveBeenCalledWith("/path/file.zip");
      expect(mockExtractAllTo).toHaveBeenCalledWith("/path/out", true);
    });

    it("should extract 7z/rar/tar archives using extract7z", async () => {
      const extract7zSpy = jest.spyOn(Extractor, "extract7z").mockResolvedValue(undefined);

      await Extractor.extractArchive("/path/file.7z", "/path/out");
      expect(extract7zSpy).toHaveBeenCalledWith("/path/file.7z", "/path/out");
      extract7zSpy.mockRestore();
    });

    it("should throw error for unsupported formats", async () => {
      await expect(Extractor.extractArchive("/path/file.txt", "/path/out")).rejects.toThrow("Unsupported archive format");
    });
  });
});
