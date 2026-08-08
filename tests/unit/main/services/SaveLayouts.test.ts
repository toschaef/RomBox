import { suiteUserDataDir } from "../../../helpers/tempDirs";
import fs from "fs";
import path from "path";

import { SaveService } from "../../../../src/main/services/SaveService";
import type { Game } from "../../../../src/shared/types";

const TEMP_DIR = suiteUserDataDir();
const EMU_DIR = path.join(TEMP_DIR, "emu");
const ROMS_DIR = path.join(TEMP_DIR, "roms");

jest.mock("../../../../src/main/platform", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const p = require("path");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const emuDir = require("path").join(require("../../../helpers/tempDirs").suiteUserDataDir(), "emu");

  // Mirrors the real Mac/Win handlers, rooted in the temp directory.
  const base = (engineId: string) => p.join(emuDir, engineId);

  return {
    osHandler: {
      getEmulatorBasePath: jest.fn((engineId: string) => base(engineId)),
      getSavePath: jest.fn((game: { engineId: string; consoleId: string; filePath: string }) => {
        switch (game.engineId) {
          case "mesen": return p.join(base("mesen"), "Saves");
          case "ares": return p.dirname(game.filePath);
          case "melonds": return p.dirname(game.filePath);
          case "dolphin": return p.join(base("dolphin"), game.consoleId === "wii" ? "Wii" : "GC");
          case "azahar": return p.join(base("azahar"), "sdmc");
          case "duckstation": return p.join(base("duckstation"), "memcards");
          case "pcsx2": return p.join(base("pcsx2"), "memcards");
          default: throw new Error(`Unknown engine: ${game.engineId}`);
        }
      }),
    },
  };
});

function game(overrides: Partial<Game> & Pick<Game, "consoleId" | "engineId">): Game {
  return {
    id: "game-1",
    title: "Test Game",
    filePath: path.join(ROMS_DIR, overrides.consoleId, "Test Game.rom"),
    playtimeSeconds: 0,
    lastPlayedAt: 0,
    ...overrides,
  } as Game;
}

function write(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function cachedFiles(consoleId: string): string[] {
  const root = path.join(TEMP_DIR, "saves", consoleId);
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else out.push(rel.split(path.sep).join("/"));
    }
  };
  walk(root, "");
  return out.sort();
}

describe("SaveService console coverage", () => {
  beforeEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  describe("Mesen", () => {
    const gb = game({
      consoleId: "gb",
      engineId: "mesen",
      title: "Pokemon - Blue Version",
      filePath: path.join(ROMS_DIR, "gb", "Pokemon - Blue Version.gb"),
    });

    it("backs up real-time-clock data alongside the battery save", () => {
      const saves = path.join(EMU_DIR, "mesen", "Saves");
      write(path.join(saves, "Pokemon - Blue Version.srm"), "battery");
      write(path.join(saves, "Pokemon - Blue Version.rtc"), "clock");

      SaveService.backupSave(gb);

      expect(cachedFiles("gb")).toEqual([
        "Pokemon - Blue Version.rtc",
        "Pokemon - Blue Version.srm",
      ]);
    });

    it("backs up save states from Mesen's separate SaveStates directory", () => {
      write(path.join(EMU_DIR, "mesen", "Saves", "Pokemon - Blue Version.srm"), "battery");
      write(path.join(EMU_DIR, "mesen", "SaveStates", "Pokemon - Blue Version_11.mss"), "state");

      SaveService.backupSave(gb);

      expect(cachedFiles("gb")).toContain("savestates/Pokemon - Blue Version_11.mss");
    });

    it("ignores saves belonging to other games in the shared Saves directory", () => {
      const saves = path.join(EMU_DIR, "mesen", "Saves");
      write(path.join(saves, "Pokemon - Blue Version.srm"), "mine");
      write(path.join(saves, "Super Mario Kart (USA).srm"), "someone else's");

      SaveService.backupSave(gb);

      expect(cachedFiles("gb")).toEqual(["Pokemon - Blue Version.srm"]);
    });
  });

  describe("ares (N64)", () => {
    const n64 = game({
      consoleId: "n64",
      engineId: "ares",
      title: "Mario Kart 64",
      filePath: path.join(ROMS_DIR, "n64", "Mario Kart 64 (USA).z64"),
    });

    it("backs up cartridge saves and controller paks written next to the ROM", () => {
      const romDir = path.join(ROMS_DIR, "n64");
      write(n64.filePath, "rom");
      write(path.join(romDir, "Mario Kart 64 (USA).eeprom"), "eeprom");
      write(path.join(romDir, "Mario Kart 64 (USA).pak"), "controller pak");
      write(path.join(romDir, "Super Mario 64 (USA).eeprom"), "other game");

      const result = SaveService.backupSave(n64);

      expect(result.backedUpFiles.sort()).toEqual([
        "Mario Kart 64 (USA).eeprom",
        "Mario Kart 64 (USA).pak",
      ]);
      expect(cachedFiles("n64")).not.toContain("Super Mario 64 (USA).eeprom");
    });

    it("restores saves next to a reinstalled ROM", () => {
      write(path.join(ROMS_DIR, "n64", "Mario Kart 64 (USA).eeprom"), "progress");
      SaveService.backupSave(n64);

      fs.rmSync(path.join(ROMS_DIR, "n64"), { recursive: true, force: true });
      const result = SaveService.restoreSave(n64);

      expect(result.restoredFiles).toContain("Mario Kart 64 (USA).eeprom");
      expect(fs.readFileSync(path.join(ROMS_DIR, "n64", "Mario Kart 64 (USA).eeprom"), "utf-8")).toBe("progress");
    });
  });

  describe("Dolphin", () => {
    it("backs up GameCube memory cards stored in nested GCI folders", () => {
      const gc = game({ consoleId: "gc", engineId: "dolphin", title: "Mario Kart - Double Dash!!" });
      const gcDir = path.join(EMU_DIR, "dolphin", "GC");
      write(path.join(gcDir, "USA", "Card A", "01-GM4E-MarioKart Double Dash!!.gci"), "gci save");
      write(path.join(gcDir, "MemoryCardA.USA.raw"), "raw card");

      SaveService.backupSave(gc);

      expect(cachedFiles("gc")).toEqual([
        "MemoryCardA.USA.raw",
        "USA/Card A/01-GM4E-MarioKart Double Dash!!.gci",
      ]);
    });

    it("round-trips the GameCube memory card tree", () => {
      const gc = game({ consoleId: "gc", engineId: "dolphin" });
      const gcDir = path.join(EMU_DIR, "dolphin", "GC");
      const gci = path.join(gcDir, "USA", "Card A", "01-GM4E-save.gci");
      write(gci, "gci save");

      SaveService.backupSave(gc);
      fs.rmSync(gcDir, { recursive: true, force: true });
      SaveService.restoreSave(gc);

      expect(fs.readFileSync(gci, "utf-8")).toBe("gci save");
    });

    it("backs up the Wii NAND but skips scratch directories", () => {
      const wii = game({ consoleId: "wii", engineId: "dolphin" });
      const wiiDir = path.join(EMU_DIR, "dolphin", "Wii");
      write(path.join(wiiDir, "title", "00010000", "524d4345", "data", "banner.bin"), "wii save");
      write(path.join(wiiDir, "tmp", "scratch.bin"), "scratch");

      SaveService.backupSave(wii);

      expect(cachedFiles("wii")).toEqual(["title/00010000/524d4345/data/banner.bin"]);
    });
  });

  describe("Azahar (3DS)", () => {
    it("backs up SD card save data and skips camera screenshots", () => {
      const threeds = game({ consoleId: "3ds", engineId: "azahar" });
      const sdmc = path.join(EMU_DIR, "azahar", "sdmc");
      write(path.join(sdmc, "Nintendo 3DS", "0".repeat(32), "0".repeat(32), "title", "00040000", "0004000000030800", "data", "00000001", "save.bin"), "3ds save");
      write(path.join(sdmc, "DCIM", "100NIN03", "HNI_0001.JPG"), "photo");

      SaveService.backupSave(threeds);

      const files = cachedFiles("3ds");
      expect(files.some(f => f.endsWith("data/00000001/save.bin"))).toBe(true);
      expect(files.some(f => f.includes("DCIM"))).toBe(false);
    });
  });

  describe("PlayStation memory cards", () => {
    it("backs up PS1 memory cards that are not named after the ROM", () => {
      const ps1 = game({ consoleId: "ps1", engineId: "duckstation", title: "Jackie Chan Stuntmaster" });
      write(path.join(EMU_DIR, "duckstation", "memcards", "Crash Bandicoot_1.mcd"), "card");
      write(path.join(EMU_DIR, "duckstation", "savestates", "SLUS-00506_resume.sav"), "state");

      SaveService.backupSave(ps1);

      expect(cachedFiles("ps1")).toEqual([
        "Crash Bandicoot_1.mcd",
        "savestates/SLUS-00506_resume.sav",
      ]);
    });

    it("backs up PS2 shared memory cards and save states", () => {
      const ps2 = game({ consoleId: "ps2", engineId: "pcsx2" });
      write(path.join(EMU_DIR, "pcsx2", "memcards", "Mcd001.ps2"), "card 1");
      write(path.join(EMU_DIR, "pcsx2", "sstates", "SLUS-20062.p2s"), "state");

      SaveService.backupSave(ps2);

      expect(cachedFiles("ps2")).toEqual(["Mcd001.ps2", "savestates/SLUS-20062.p2s"]);
    });

    it("never deletes a shared memory card on behalf of one game", () => {
      const ps2 = game({ consoleId: "ps2", engineId: "pcsx2" });
      write(path.join(EMU_DIR, "pcsx2", "memcards", "Mcd001.ps2"), "everyone's saves");
      SaveService.backupSave(ps2);

      const result = SaveService.deleteCachedSave(ps2);

      expect(result.deletedFiles).toHaveLength(0);
      expect(cachedFiles("ps2")).toEqual(["Mcd001.ps2"]);
    });
  });

  describe("empty directories", () => {
    it("preserves empty save directories through a backup/restore round trip", () => {
      const threeds = game({ consoleId: "3ds", engineId: "azahar" });
      const saveDir = path.join(EMU_DIR, "azahar", "sdmc", "title", "00040000", "00030800", "data", "00000001");
      write(path.join(saveDir, "system5.dat"), "save");
      // Azahar leaves this behind next to the real save data.
      fs.mkdirSync(path.join(saveDir, "replay_"), { recursive: true });

      SaveService.backupSave(threeds);
      fs.rmSync(path.join(EMU_DIR, "azahar", "sdmc"), { recursive: true, force: true });
      SaveService.restoreSave(threeds);

      expect(fs.existsSync(path.join(saveDir, "replay_"))).toBe(true);
      expect(fs.readFileSync(path.join(saveDir, "system5.dat"), "utf-8")).toBe("save");
    });

    it("does not recreate directories holding only files RomBox filters out", () => {
      const gc = game({ consoleId: "gc", engineId: "dolphin" });
      const gcDir = path.join(EMU_DIR, "dolphin", "GC");
      write(path.join(gcDir, "USA", "Card A", "01-GM4E-save.gci"), "gci");
      write(path.join(gcDir, "Logs", "dolphin.log"), "not save data");

      SaveService.backupSave(gc);

      expect(cachedFiles("gc")).toEqual(["USA/Card A/01-GM4E-save.gci"]);
      expect(fs.existsSync(path.join(TEMP_DIR, "saves", "gc", "Logs"))).toBe(false);
    });
  });

  describe("backup safety", () => {
    it("does not overwrite emulator save data that is newer than the cache", () => {
      const gb = game({ consoleId: "gb", engineId: "mesen", filePath: path.join(ROMS_DIR, "gb", "Test Game.gb") });
      const live = path.join(EMU_DIR, "mesen", "Saves", "Test Game.srm");
      write(live, "old progress");
      SaveService.backupSave(gb);

      write(live, "new progress");
      const future = new Date(Date.now() + 60_000);
      fs.utimesSync(live, future, future);

      SaveService.restoreSave(gb);

      expect(fs.readFileSync(live, "utf-8")).toBe("new progress");
    });

    it("reports a cached-save status for container-based consoles", () => {
      const wii = game({ consoleId: "wii", engineId: "dolphin" });
      write(path.join(EMU_DIR, "dolphin", "Wii", "title", "00010000", "524d4345", "data", "banner.bin"), "wii save");
      SaveService.backupSave(wii);

      const status = SaveService.getSaveStatus(wii);

      expect(status.hasCachedSave).toBe(true);
      expect(status.cachedFiles).toHaveLength(1);
      expect(status.cachedFiles[0].fileName).toBe("wii-nand (1 file)");
    });
  });
});
