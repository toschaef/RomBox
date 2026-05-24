import fs from "fs";
import { LibraryService } from "../../../src/main/services/LibraryService";
import { initDB, getDB } from "../../../src/main/data/db";
import type { Game } from "../../../src/shared/types";

jest.mock("../../../src/main/services/ScannerService", () => ({
  ScannerService: {
    scanPath: jest.fn(),
    importGame: jest.fn(),
    importBios: jest.fn()
  }
}));

describe("LibraryService", () => {
  beforeEach(() => {
    try {
      const db = getDB();
      db.prepare("DELETE FROM games").run();
    } catch {
      initDB();
      const db = getDB();
      db.prepare("DELETE FROM games").run();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockGame: Game = {
    id: "mario-bros",
    title: "Super Mario Bros.",
    filePath: "/roms/smb.nes",
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: 0
  };

  it("should create and retrieve a game", () => {
    const createResult = LibraryService.createGame(mockGame);
    expect(createResult.success).toBe(true);
    expect(createResult.game).toEqual(mockGame);

    const getResult = LibraryService.getGame("mario-bros");
    expect(getResult.success).toBe(true);
    expect(getResult.game?.id).toBe("mario-bros");
    expect(getResult.game?.title).toBe("Super Mario Bros.");
  });

  it("should list all games in the library", () => {
    LibraryService.createGame(mockGame);
    LibraryService.createGame({
      ...mockGame,
      id: "zelda",
      title: "The Legend of Zelda"
    });

    const getResult = LibraryService.getGames();
    expect(getResult.success).toBe(true);
    expect(getResult.games?.length).toBe(2);
  });

  it("should return success false if game not found", () => {
    const getResult = LibraryService.getGame("non-existent");
    expect(getResult.success).toBe(false);
    expect(getResult.message).toBe("Game not found");
  });

  it("should update game metadata successfully", () => {
    LibraryService.createGame(mockGame);
    const updatedGame = {
      ...mockGame,
      title: "Super Mario Bros. Deluxe"
    };

    const updateResult = LibraryService.updateGame(updatedGame);
    expect(updateResult.success).toBe(true);

    const checkResult = LibraryService.getGame("mario-bros");
    expect(checkResult.game?.title).toBe("Super Mario Bros. Deluxe");
  });

  it("should delete a game and remove its rom file if it exists", () => {
    const tempRomPath = "/tmp/smb.nes";
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => { /* mock */ });
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, "unlinkSync").mockImplementation(() => { /* mock */ });

    const game = {
      ...mockGame,
      filePath: tempRomPath
    };
    LibraryService.createGame(game);

    const deleteResult = LibraryService.deleteGame("mario-bros");
    expect(deleteResult.success).toBe(true);
    expect(unlinkSpy).toHaveBeenCalledWith(tempRomPath);

    const getResult = LibraryService.getGame("mario-bros");
    expect(getResult.success).toBe(false);
  });

  it("should increment playtime successfully", () => {
    LibraryService.createGame(mockGame);
    const playResult = LibraryService.addPlaytime("mario-bros", 120);
    expect(playResult.success).toBe(true);

    const checkResult = LibraryService.getGame("mario-bros");
    expect(checkResult.game?.playtimeSeconds).toBe(120);
  });

  it("should update last played timestamp", () => {
    LibraryService.createGame(mockGame);
    const result = LibraryService.updateLastPlayed("mario-bros");
    expect(result.success).toBe(true);

    const checkResult = LibraryService.getGame("mario-bros");
    expect(checkResult.game?.lastPlayedAt).toBeGreaterThan(0);
  });

  it("should clear the library database entries", () => {
    LibraryService.createGame(mockGame);
    const clearResult = LibraryService.clearLibrary();
    expect(clearResult.success).toBe(true);

    const listResult = LibraryService.getGames();
    expect(listResult.games?.length).toBe(0);
  });
});
