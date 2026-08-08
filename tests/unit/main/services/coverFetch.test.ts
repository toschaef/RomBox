// cover lookup walks a list of libretro repos and title variants, and records
// misses in a negative cache so a missing cover is not re-fetched forever.
import fs from "fs";
import path from "path";

import { CoverService } from "../../../../src/main/services/CoverService";
import { Downloader } from "../../../../src/main/utils/downloader";
import { suiteUserDataDir } from "../../../helpers/tempDirs";
import type { Game } from "../../../../src/shared/types";

jest.mock("../../../../src/main/utils/downloader", () => ({
  Downloader: { download: jest.fn() },
}));

const download = Downloader.download as jest.Mock;

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "g1",
    title: "Super Mario Bros.",
    filePath: "/roms/nes/Super Mario Bros..nes",
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: null,
    ...overrides,
  } as Game;
}

/** downloader writes the file at the url's basename inside destDir */
function succeedOnce() {
  download.mockImplementationOnce(async (url: string, destDir: string) => {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, path.basename(url.split("?")[0])), "png-bytes");
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  fs.rmSync(path.join(suiteUserDataDir(), "covers"), { recursive: true, force: true });
  fs.rmSync(path.join(suiteUserDataDir(), "failed-covers.json"), { force: true });
  download.mockRejectedValue(new Error("404"));
});

afterAll(() => fs.rmSync(suiteUserDataDir(), { recursive: true, force: true }));

describe("cover cache", () => {
  it("reports no cover before anything is downloaded", () => {
    expect(CoverService.hasCover(makeGame())).toBe(false);
  });

  it("puts covers under a per-console directory", () => {
    const p = CoverService.getCoverPath(makeGame());
    expect(p).toContain(path.join("covers", "nes"));
    expect(p.endsWith(".png")).toBe(true);
  });

  it("strips the rom extension from the cached filename", () => {
    const p = CoverService.getCoverPath(makeGame({ title: "Zelda.nes" }));
    expect(path.basename(p)).toBe("Zelda.png");
  });

  it("replaces characters that are illegal in filenames", () => {
    const p = CoverService.getCoverPath(makeGame({ title: 'A:B/C*D?"E' }));
    expect(path.basename(p)).not.toMatch(/[:*?"]/);
  });

  it("returns the cached file without downloading again", async () => {
    const game = makeGame();
    const coverPath = CoverService.getCoverPath(game);
    fs.mkdirSync(path.dirname(coverPath), { recursive: true });
    fs.writeFileSync(coverPath, "cached");

    expect(CoverService.hasCover(game)).toBe(true);
    await expect(CoverService.getCover(game)).resolves.toBe(coverPath);
    expect(download).not.toHaveBeenCalled();
  });
});

describe("fetchCover", () => {
  it("downloads from the console's libretro repo", async () => {
    succeedOnce();

    const result = await CoverService.fetchCover(makeGame());

    expect(result).toBe(CoverService.getCoverPath(makeGame()));
    const url = download.mock.calls[0][0] as string;
    expect(url).toContain("libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System");
    expect(url).toContain("Named_Boxarts");
  });

  it("tries title variants when the exact name misses", async () => {
    download.mockRejectedValueOnce(new Error("404"));
    succeedOnce();

    const result = await CoverService.fetchCover(makeGame({ title: "Super Mario Bros. (USA)" }));

    expect(result).not.toBeNull();
    expect(download.mock.calls.length).toBeGreaterThan(1);
  });

  it("prefers the Game Boy Color repo for a .gbc rom", async () => {
    succeedOnce();

    await CoverService.fetchCover(
      makeGame({ id: "gbc", consoleId: "gb", title: "Zelda", filePath: "/roms/gb/Zelda.gbc" })
    );

    expect(download.mock.calls[0][0]).toContain("Game_Boy_Color");
  });

  it("prefers the Game Boy repo for a .gb rom", async () => {
    succeedOnce();

    await CoverService.fetchCover(
      makeGame({ id: "gb", consoleId: "gb", title: "Tetris", filePath: "/roms/gb/Tetris.gb" })
    );

    const first = download.mock.calls[0][0] as string;
    expect(first).toContain("Nintendo_-_Game_Boy/");
  });

  it("returns null and records the miss when every candidate fails", async () => {
    const game = makeGame({ id: "missing" });

    expect(await CoverService.fetchCover(game)).toBeNull();

    // a second attempt short-circuits on the negative cache
    const callsAfterFirst = download.mock.calls.length;
    expect(await CoverService.fetchCover(game)).toBeNull();
    expect(download.mock.calls.length).toBe(callsAfterFirst);
  });

  it("persists the negative cache to disk", async () => {
    await CoverService.fetchCover(makeGame({ id: "persisted" }));

    const cacheFile = path.join(suiteUserDataDir(), "failed-covers.json");
    expect(fs.existsSync(cacheFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(cacheFile, "utf-8"))).toContain("persisted");
  });

  it("returns null for a console with no repo mapping", async () => {
    const result = await CoverService.fetchCover(
      makeGame({ id: "odd", consoleId: "unknown" as Game["consoleId"] })
    );

    expect(result).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });
});
