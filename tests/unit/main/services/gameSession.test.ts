// the close handler carries playtime and the save backup that makes progress
// survive.
import { startSession } from "../../../../src/main/services/launch/GameSession";
import { LibraryService } from "../../../../src/main/services/LibraryService";
import { SaveService } from "../../../../src/main/services/SaveService";
import { osHandler } from "../../../../src/main/platform";
import { BrowserWindow } from "electron";
import type { Game } from "../../../../src/shared/types";

jest.mock("../../../../src/main/services/LibraryService", () => ({
  LibraryService: { addPlaytime: jest.fn() },
}));

jest.mock("../../../../src/main/services/SaveService", () => ({
  SaveService: { backupSave: jest.fn().mockReturnValue({ backedUpFiles: [] }) },
}));

jest.mock("../../../../src/main/platform", () => ({
  osHandler: { launchProcess: jest.fn() },
}));

jest.mock("electron", () => ({
  app: { getPath: jest.fn().mockReturnValue("/mock/userData") },
  BrowserWindow: { getAllWindows: jest.fn().mockReturnValue([]) },
}));

const game = {
  id: "game-1",
  title: "Test Game",
  filePath: "/roms/nes/Test Game.nes",
  consoleId: "nes",
  engineId: "mesen",
} as Game;

/** Captures the process handlers so tests can fire `close` themselves. */
function spawnSession() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const child = {
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    unref: jest.fn(),
  };
  (osHandler.launchProcess as jest.Mock).mockReturnValue(child);

  startSession(game, "/engines/mesen/Mesen", ["--fullscreen", game.filePath]);
  return { child, handlers };
}

describe("startSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (SaveService.backupSave as jest.Mock).mockReturnValue({ backedUpFiles: [] });
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => jest.useRealTimers());

  it("spawns the emulator and detaches from it", () => {
    const { child } = spawnSession();

    expect(osHandler.launchProcess).toHaveBeenCalledWith("/engines/mesen/Mesen", [
      "--fullscreen",
      "/roms/nes/Test Game.nes",
    ]);
    // detached, so quitting RomBox does not kill the running game.
    expect(child.unref).toHaveBeenCalled();
  });

  it("records elapsed playtime when the emulator exits", () => {
    const { handlers } = spawnSession();

    jest.advanceTimersByTime(90_000);
    handlers.close(0);

    expect(LibraryService.addPlaytime).toHaveBeenCalledWith("game-1", 90);
  });

  it("does not record a session shorter than a second", () => {
    const { handlers } = spawnSession();

    handlers.close(0);

    expect(LibraryService.addPlaytime).not.toHaveBeenCalled();
  });

  it("backs up saves on exit", () => {
    const { handlers } = spawnSession();

    (SaveService.backupSave as jest.Mock).mockReturnValue({ backedUpFiles: ["smb.sav"] });
    handlers.close(0);

    expect(SaveService.backupSave).toHaveBeenCalledWith(game);
  });

  it("still backs up saves after a crash", () => {
    const { handlers } = spawnSession();

    handlers.close(139);

    expect(SaveService.backupSave).toHaveBeenCalledWith(game);
  });

  it("records playtime even when the backup throws", () => {
    const { handlers } = spawnSession();
    (SaveService.backupSave as jest.Mock).mockImplementation(() => {
      throw new Error("disk full");
    });

    jest.advanceTimersByTime(5_000);
    expect(() => handlers.close(0)).not.toThrow();

    expect(LibraryService.addPlaytime).toHaveBeenCalledWith("game-1", 5);
  });

  it("tells every open window the game exited", () => {
    const send = jest.fn();
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([{ webContents: { send } }]);

    const { handlers } = spawnSession();
    handlers.close(0);

    expect(send).toHaveBeenCalledWith("game-exited", { gameId: "game-1", code: 0 });
  });

  it("survives a spawn error without throwing", () => {
    const { handlers } = spawnSession();
    expect(() => handlers.error(new Error("ENOENT"))).not.toThrow();
  });
});
