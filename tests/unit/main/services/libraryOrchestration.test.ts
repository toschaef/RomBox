// the paths that destroy data: deleting a game removes any rom rombox extracted
// itself, and ares/melonds keep saves next to it, so backups have to happen
// first. files the library only references are never deleted.
import fs from "fs";
import path from "path";
import { LibraryService } from "../../../../src/main/services/LibraryService";
import { ScannerService } from "../../../../src/main/services/ScannerService";
import { SaveService } from "../../../../src/main/services/SaveService";
import { gamesRepository } from "../../../../src/main/data/repositories/GamesRepository";
import { suiteUserDataDir } from "../../../helpers/tempDirs";
import type { Game } from "../../../../src/shared/types";

jest.mock("../../../../src/main/services/ScannerService", () => ({
  ScannerService: { scanPath: jest.fn(), importGame: jest.fn(), importBios: jest.fn() },
}));

jest.mock("../../../../src/main/services/SaveService", () => ({
  SaveService: { backupSave: jest.fn().mockReturnValue({ backedUpFiles: [] }) },
}));

jest.mock("../../../../src/main/data/repositories/GamesRepository", () => ({
  gamesRepository: {
    insert: jest.fn(),
    findAll: jest.fn().mockReturnValue([]),
    findById: jest.fn(),
    updateTitleAndConsole: jest.fn(),
    updateFilePath: jest.fn(),
    delete: jest.fn(),
    deleteAll: jest.fn(),
    addPlaytime: jest.fn(),
    setLastPlayed: jest.fn(),
  },
}));

const repo = gamesRepository as jest.Mocked<typeof gamesRepository>;

/** inside userData/roms - i.e. a copy rombox extracted and therefore owns */
const MANAGED_ROM = path.join(suiteUserDataDir(), "roms", "nes", "Test Game.nes");

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "g1",
    title: "Test Game",
    filePath: MANAGED_ROM,
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: null,
    ...overrides,
  } as Game;
}

beforeEach(() => {
  jest.clearAllMocks();
  (SaveService.backupSave as jest.Mock).mockReturnValue({ backedUpFiles: [] });
  repo.findAll.mockReturnValue([]);
});

afterEach(() => jest.restoreAllMocks());

describe("createGamesFromFiles", () => {
  it("imports every game a scan found", async () => {
    const a = makeGame({ id: "a" });
    const b = makeGame({ id: "b" });
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([
      { type: "game" }, { type: "game" },
    ]);
    (ScannerService.importGame as jest.Mock)
      .mockResolvedValueOnce(a).mockResolvedValueOnce(b);

    const result = await LibraryService.createGamesFromFiles({ name: "d", path: "/drop" });

    expect(result.success).toBe(true);
    expect(result.games).toEqual([a, b]);
    expect(repo.insert).toHaveBeenCalledTimes(2);
  });

  it("routes bios entries to the scanner instead of the library", async () => {
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([{ type: "bios" }]);

    const result = await LibraryService.createGamesFromFiles({ name: "d", path: "/drop" });

    expect(ScannerService.importBios).toHaveBeenCalled();
    expect(repo.insert).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
    expect(result.message).toContain("only system files");
  });

  it("reports when a scan finds nothing", async () => {
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([]);

    const result = await LibraryService.createGamesFromFiles({ name: "d", path: "/drop" });
    expect(result).toMatchObject({ success: false });
    expect(result.message).toContain("No identifiable games");
  });

  it("returns the failure rather than throwing when an import fails", async () => {
    (ScannerService.scanPath as jest.Mock).mockResolvedValue([{ type: "game" }]);
    (ScannerService.importGame as jest.Mock).mockRejectedValue(new Error("bad rom"));

    const result = await LibraryService.createGamesFromFiles({ name: "d", path: "/drop" });
    expect(result).toEqual({ success: false, message: "bad rom" });
  });
});

describe("deleteGame", () => {
  it("backs up saves before removing anything", () => {
    const game = makeGame();
    repo.findById.mockReturnValue(game);
    const order: string[] = [];
    (SaveService.backupSave as jest.Mock).mockImplementation(() => {
      order.push("backup");
      return { backedUpFiles: ["smb.sav"] };
    });
    repo.delete.mockImplementation(() => { order.push("delete"); return true; });
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    LibraryService.deleteGame("g1");

    // ares and melonds store saves next to the rom, so this order matters
    expect(order).toEqual(["backup", "delete"]);
  });

  it("deletes an extracted rom from disk", () => {
    repo.findById.mockReturnValue(makeGame());
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const unlink = jest.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);

    expect(LibraryService.deleteGame("g1")).toEqual({ success: true });
    expect(unlink).toHaveBeenCalledWith(MANAGED_ROM);
  });

  it("leaves a referenced rom on disk", () => {
    // the file is the user's, sitting outside userData - the library entry goes
    // away, the game does not
    repo.findById.mockReturnValue(makeGame({ filePath: "/Users/someone/Games/Test Game.nes" }));
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const unlink = jest.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);
    const rm = jest.spyOn(fs, "rmSync").mockImplementation(() => undefined);

    expect(LibraryService.deleteGame("g1")).toEqual({ success: true });
    expect(repo.delete).toHaveBeenCalledWith("g1");
    expect(unlink).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalled();
  });

  it("still backs up saves for a referenced rom", () => {
    // ares/melonds write saves next to the rom, wherever that is
    repo.findById.mockReturnValue(makeGame({ filePath: "/Users/someone/Games/Test Game.nes" }));
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);

    LibraryService.deleteGame("g1");

    expect(SaveService.backupSave).toHaveBeenCalled();
  });

  it("removes a directory rom recursively", () => {
    // ps1 games can be a folder of .bin/.cue files
    repo.findById.mockReturnValue(makeGame({
      filePath: path.join(suiteUserDataDir(), "roms", "ps1", "Game"),
    }));
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "unlinkSync").mockImplementation(() => {
      const err = new Error("is a directory") as NodeJS.ErrnoException;
      err.code = "EISDIR";
      throw err;
    });
    const rm = jest.spyOn(fs, "rmSync").mockImplementation(() => undefined);

    expect(LibraryService.deleteGame("g1")).toEqual({ success: true });
    expect(rm).toHaveBeenCalledWith(
      path.join(suiteUserDataDir(), "roms", "ps1", "Game"),
      { recursive: true, force: true }
    );
  });

  it("reports an unexpected filesystem error", () => {
    repo.findById.mockReturnValue(makeGame());
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "unlinkSync").mockImplementation(() => {
      throw new Error("permission denied");
    });

    expect(LibraryService.deleteGame("g1")).toEqual({
      success: false,
      message: "permission denied",
    });
  });

  it("still deletes the row when the backup throws", () => {
    repo.findById.mockReturnValue(makeGame());
    (SaveService.backupSave as jest.Mock).mockImplementation(() => {
      throw new Error("disk full");
    });
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(LibraryService.deleteGame("g1")).toEqual({ success: true });
    expect(repo.delete).toHaveBeenCalledWith("g1");
  });

  it("reports a game that does not exist", () => {
    repo.findById.mockReturnValue(null);
    expect(LibraryService.deleteGame("nope")).toEqual({
      success: false,
      message: "Game not found",
    });
    expect(repo.delete).not.toHaveBeenCalled();
  });
});

describe("clearLibrary", () => {
  it("backs up every game before wiping the table", () => {
    const games = [makeGame({ id: "a" }), makeGame({ id: "b" })];
    repo.findAll.mockReturnValue(games);
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(LibraryService.clearLibrary()).toEqual({ success: true });

    expect(SaveService.backupSave).toHaveBeenCalledTimes(2);
    expect(repo.deleteAll).toHaveBeenCalled();
  });

  it("recreates the roms directory after removing it", () => {
    repo.findAll.mockReturnValue([]);
    const romsDir = path.join(suiteUserDataDir(), "roms");
    jest.spyOn(fs, "existsSync").mockImplementation((p) => p === romsDir);
    const rm = jest.spyOn(fs, "rmSync").mockImplementation(() => undefined);
    const mkdir = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);

    LibraryService.clearLibrary();

    expect(rm).toHaveBeenCalledWith(romsDir, { recursive: true, force: true });
    expect(mkdir).toHaveBeenCalledWith(romsDir);
  });

  it("clears the table even when a backup throws", () => {
    repo.findAll.mockReturnValue([makeGame()]);
    (SaveService.backupSave as jest.Mock).mockImplementation(() => {
      throw new Error("disk full");
    });
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(LibraryService.clearLibrary()).toEqual({ success: true });
    expect(repo.deleteAll).toHaveBeenCalled();
  });
});

describe("error propagation", () => {
  it("rethrows an insert failure so the caller sees it", () => {
    repo.insert.mockImplementation(() => { throw new Error("constraint failed"); });
    expect(() => LibraryService.createGame(makeGame())).toThrow("constraint failed");
  });

  it("returns a message instead of throwing on read failures", () => {
    repo.findAll.mockImplementation(() => { throw new Error("db gone"); });
    expect(LibraryService.getGames()).toEqual({ success: false, message: "db gone" });

    repo.findById.mockImplementation(() => { throw new Error("db gone"); });
    expect(LibraryService.getGame("g1")).toEqual({ success: false, message: "db gone" });
  });

  it("returns a message instead of throwing on write failures", () => {
    repo.updateTitleAndConsole.mockImplementation(() => { throw new Error("locked"); });
    expect(LibraryService.updateGame(makeGame())).toEqual({ success: false, message: "locked" });

    repo.addPlaytime.mockImplementation(() => { throw new Error("locked"); });
    expect(LibraryService.addPlaytime("g1", 5)).toEqual({ success: false, message: "locked" });

    repo.setLastPlayed.mockImplementation(() => { throw new Error("locked"); });
    expect(LibraryService.updateLastPlayed("g1")).toEqual({ success: false, message: "locked" });
  });

  it("reports a missing game without an error", () => {
    repo.findById.mockReturnValue(null);
    expect(LibraryService.getGame("nope")).toEqual({
      success: false,
      message: "Game not found",
    });
  });

  it("passes through whether a write matched a row", () => {
    repo.addPlaytime.mockReturnValue(false);
    expect(LibraryService.addPlaytime("nope", 5)).toEqual({ success: false });

    repo.setLastPlayed.mockReturnValue(true);
    expect(LibraryService.updateLastPlayed("g1")).toEqual({ success: true });
  });
});
