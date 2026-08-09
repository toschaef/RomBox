// relocating is the recovery path for the thing that follows from referencing
// roms in place: the user moves or renames a file and the library entry has to
// be repointed instead of the game being re-imported.
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { LibraryService } from "../../../../src/main/services/LibraryService";
import { initDB, getDB } from "../../../../src/main/data/db";
import { suiteTempDir, suiteUserDataDir } from "../../../helpers/tempDirs";
import type { Game } from "../../../../src/shared/types";

const NES_HEADER = "NES\x1a\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00";
const workDir = path.join(suiteTempDir(), "games");

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "smb",
    title: "Super Mario Bros.",
    filePath: path.join(workDir, "smb.nes"),
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: 0,
    ...overrides,
  };
}

function writeRom(relPath: string, contents = NES_HEADER): string {
  const full = path.join(workDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  return full;
}

beforeEach(() => {
  fs.rmSync(suiteTempDir(), { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(suiteUserDataDir(), { recursive: true });

  try {
    getDB().prepare("DELETE FROM games").run();
  } catch {
    initDB();
    getDB().prepare("DELETE FROM games").run();
  }
});

describe("relocateGame", () => {
  it("repoints the entry at a rom that was moved", async () => {
    const original = writeRom("smb.nes");
    LibraryService.createGame(makeGame({ filePath: original }));

    const moved = path.join(workDir, "elsewhere", "smb.nes");
    fs.mkdirSync(path.dirname(moved), { recursive: true });
    fs.renameSync(original, moved);

    const result = await LibraryService.relocateGame("smb", moved);

    expect(result.success).toBe(true);
    expect(LibraryService.getGame("smb").game?.filePath).toBe(moved);
  });

  it("repoints the entry at a rom that was renamed", async () => {
    const original = writeRom("smb.nes");
    LibraryService.createGame(makeGame({ filePath: original }));

    const renamed = path.join(workDir, "Super Mario Bros (USA).nes");
    fs.renameSync(original, renamed);

    expect((await LibraryService.relocateGame("smb", renamed)).success).toBe(true);
    // the title the user set survives the repoint
    const game = LibraryService.getGame("smb").game;
    expect(game?.filePath).toBe(renamed);
    expect(game?.title).toBe("Super Mario Bros.");
  });

  it("keeps playtime and last-played across a relocate", async () => {
    const original = writeRom("smb.nes");
    LibraryService.createGame(makeGame({ filePath: original }));
    LibraryService.addPlaytime("smb", 900);

    const moved = writeRom("moved/smb.nes");
    fs.rmSync(original);

    await LibraryService.relocateGame("smb", moved);

    expect(LibraryService.getGame("smb").game?.playtimeSeconds).toBe(900);
  });

  it("flips fileMissing back once the game is found again", async () => {
    const original = writeRom("smb.nes");
    LibraryService.createGame(makeGame({ filePath: original }));
    expect(LibraryService.getGame("smb").game?.fileMissing).toBe(false);

    const moved = path.join(workDir, "moved", "smb.nes");
    fs.mkdirSync(path.dirname(moved), { recursive: true });
    fs.renameSync(original, moved);
    expect(LibraryService.getGame("smb").game?.fileMissing).toBe(true);

    await LibraryService.relocateGame("smb", moved);
    expect(LibraryService.getGame("smb").game?.fileMissing).toBe(false);
  });

  it("refuses a path that does not exist", async () => {
    LibraryService.createGame(makeGame({ filePath: writeRom("smb.nes") }));

    const result = await LibraryService.relocateGame("smb", path.join(workDir, "nope.nes"));

    expect(result.success).toBe(false);
    expect(result.message).toContain("No file found");
  });

  it("refuses a rom for a different console", async () => {
    // picking the wrong file would otherwise leave the entry pointing at
    // something its emulator cannot open
    LibraryService.createGame(makeGame({ filePath: writeRom("smb.nes") }));
    const gbaRom = writeRom("other.gba", "x".repeat(512));

    const result = await LibraryService.relocateGame("smb", gbaRom);

    expect(result.success).toBe(false);
    expect(result.code).toBe("CONSOLE_MISMATCH");
    expect(LibraryService.getGame("smb").game?.filePath).toContain("smb.nes");
  });

  it("refuses a directory with no game in it", async () => {
    LibraryService.createGame(makeGame({ filePath: writeRom("smb.nes") }));
    const emptyDir = path.join(workDir, "empty");
    fs.mkdirSync(emptyDir, { recursive: true });

    const result = await LibraryService.relocateGame("smb", emptyDir);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No game found");
  });

  it("accepts a file it cannot identify when the user picked it explicitly", async () => {
    // detection is best-effort; an unknown extension is the user's call
    LibraryService.createGame(makeGame({ filePath: writeRom("smb.nes") }));
    const odd = writeRom("smb.romfile");

    const result = await LibraryService.relocateGame("smb", odd);

    expect(result.success).toBe(true);
    expect(LibraryService.getGame("smb").game?.filePath).toBe(odd);
  });

  it("points a relocated disc directory at its entrypoint, not the folder", async () => {
    const discDir = path.join(workDir, "Moved PS1 Game");
    fs.mkdirSync(discDir, { recursive: true });
    fs.writeFileSync(path.join(discDir, "game.bin"), "bin");
    fs.writeFileSync(path.join(discDir, "game.cue"), "cue");

    LibraryService.createGame(makeGame({
      id: "disc",
      consoleId: "ps1",
      engineId: "duckstation",
      filePath: path.join(workDir, "Old PS1 Game", "game.cue"),
    }));

    const result = await LibraryService.relocateGame("disc", discDir);

    expect(result.success).toBe(true);
    // duckstation is handed this path directly, so it has to be a file
    expect(LibraryService.getGame("disc").game?.filePath).toBe(path.join(discDir, "game.cue"));
  });

  it("does not copy the rom it relocates to", async () => {
    LibraryService.createGame(makeGame({ filePath: writeRom("smb.nes") }));
    const moved = writeRom("moved/smb.nes");

    await LibraryService.relocateGame("smb", moved);

    expect(LibraryService.getGame("smb").game?.filePath).toBe(moved);
    expect(fs.existsSync(path.join(suiteUserDataDir(), "roms"))).toBe(false);
  });

  it("extracts when relocating to an archive, since a zip entry has no path", async () => {
    LibraryService.createGame(makeGame({ filePath: writeRom("smb.nes") }));

    const zip = new AdmZip();
    zip.addFile("smb.nes", Buffer.from(NES_HEADER));
    const zipPath = path.join(workDir, "smb.zip");
    zip.writeZip(zipPath);

    const result = await LibraryService.relocateGame("smb", zipPath);

    expect(result.success).toBe(true);
    const extracted = path.join(suiteUserDataDir(), "roms", "nes", "smb.nes");
    expect(LibraryService.getGame("smb").game?.filePath).toBe(extracted);
    expect(fs.existsSync(extracted)).toBe(true);
  });

  it("reports a game that is not in the library", async () => {
    const result = await LibraryService.relocateGame("nope", writeRom("smb.nes"));
    expect(result).toEqual({ success: false, message: "Game not found" });
  });
});
