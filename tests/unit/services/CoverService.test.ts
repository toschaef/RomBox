import fs, { PathLike } from "fs";
import path from "path";
import { CoverService } from "../../../src/main/services/CoverService";
import { Downloader } from "../../../src/main/utils/downloader";
import type { Game } from "../../../src/shared/types";

jest.mock("../../../src/main/utils/downloader", () => ({
  Downloader: {
    download: jest.fn()
  }
}));

describe("CoverService", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");

  const mockGame: Game = {
    id: "mario-bros",
    title: "Super Mario Bros.",
    filePath: "/roms/smb.nes",
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should return cover cache path for a game", () => {
    const p = CoverService.getCoverPath(mockGame);
    expect(p).toContain("covers/nes/Super Mario Bros..png");
  });

  it("should report cover availability correctly based on filesystem existence", () => {
    const existsSpy = jest.spyOn(fs, "existsSync").mockImplementation((p: PathLike) => {
      return p.toString().includes("covers/nes/Super Mario Bros..png");
    });
    expect(CoverService.hasCover(mockGame)).toBe(true);

    existsSpy.mockReturnValue(false);
    expect(CoverService.hasCover(mockGame)).toBe(false);
  });

  it("should fetch cover artwork and download successfully via Downloader", async () => {
    let callCount = 0;
    jest.spyOn(fs, "existsSync").mockImplementation(() => {
      callCount++;
      // First is FAILED_CACHE_FILE check, second is hasCover check (returns false)
      if (callCount <= 2) return false;
      // subsequent are download path or dest path checks (returns true to mock successful download)
      return true;
    });

    jest.spyOn(fs, "renameSync").mockImplementation(() => { /* mock */ });
    (Downloader.download as jest.Mock).mockResolvedValue("/mock/dest/file.png");

    const result = await CoverService.fetchCover(mockGame);
    expect(result).toContain("covers/nes/Super Mario Bros..png");
    expect(Downloader.download).toHaveBeenCalled();
  });
});
