import { suiteUserDataDir } from "../../../helpers/tempDirs";
import fs from "fs";
import path from "path";

import AdmZip from "adm-zip";

import { SaveService } from "../../../../src/main/services/SaveService";
import type { Game } from "../../../../src/shared/types";

const TEMP_DIR = suiteUserDataDir();
const EMU_DIR = path.join(TEMP_DIR, "emu");
const ROMS_DIR = path.join(TEMP_DIR, "roms");
const INBOX_DIR = path.join(TEMP_DIR, "inbox");
const CACHE_DIR = path.join(TEMP_DIR, "saves");

jest.mock("../../../../src/main/platform", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const p = require("path");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const emuDir = require("path").join(require("../../../helpers/tempDirs").suiteUserDataDir(), "emu");
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

// ---------------------------------------------------------------------------
// Fixtures built to each format's real invariants, so a test that passes means
// the validator accepts genuine files and not merely the bytes it was handed.
// ---------------------------------------------------------------------------

/** PS1 card: 128 KB, "MC" magic, every header frame ending in its XOR checksum. */
function buildPs1Card(): Buffer {
  const card = Buffer.alloc(128 * 1024);
  card.write("MC", 0, "latin1");

  for (let frame = 0; frame < 16; frame++) {
    const start = frame * 128;
    let checksum = 0;
    for (let i = start; i < start + 127; i++) checksum ^= card[i];
    card[start + 127] = checksum;
  }

  return card;
}

/** PS2 card: header magic plus the nominal size inflated by its ECC bytes. */
function buildPs2Card(): Buffer {
  const card = Buffer.alloc((8 * 1024 * 1024 * 33) / 32);
  card.write("Sony PS2 Memory Card Format 1.2.0.0", 0, "latin1");
  return card;
}

/** GCI: 64 byte entry whose declared block count matches the payload. */
function buildGci(blocks = 3, gameCode = "GM4E"): Buffer {
  const gci = Buffer.alloc(0x40 + blocks * 8192);
  gci.write(gameCode, 0, "latin1");
  gci.write("01", 4, "latin1");
  gci.writeUInt16BE(blocks, 0x38);
  return gci;
}

function buildMesenState(): Buffer {
  const state = Buffer.alloc(1024);
  state.write("MSS", 0, "latin1");
  return state;
}

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

function inbox(fileName: string, contents: Buffer): string {
  const filePath = path.join(INBOX_DIR, fileName);
  fs.mkdirSync(INBOX_DIR, { recursive: true });
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function archive(fileName: string, entries: Record<string, Buffer>): string {
  const zip = new AdmZip();
  for (const [entryName, contents] of Object.entries(entries)) {
    zip.addFile(entryName, contents);
  }
  fs.mkdirSync(INBOX_DIR, { recursive: true });
  const filePath = path.join(INBOX_DIR, fileName);
  zip.writeZip(filePath);
  return filePath;
}

/**
 * Writes an archive holding a path traversal entry. AdmZip sanitizes names as
 * it writes, so the name is patched into the finished bytes - which is what a
 * hostile archive built by another tool looks like.
 */
function archiveWithTraversalEntry(fileName: string): string {
  const placeholder = "aa/bb/evil.sh";
  const traversal = "../../evil.sh"; // same length, so the zip offsets stay valid

  const zip = new AdmZip();
  zip.addFile(placeholder, Buffer.from("rm -rf"));
  const patched = Buffer.from(
    zip.toBuffer().toString("latin1").split(placeholder).join(traversal),
    "latin1",
  );

  fs.mkdirSync(INBOX_DIR, { recursive: true });
  const filePath = path.join(INBOX_DIR, fileName);
  fs.writeFileSync(filePath, patched);
  return filePath;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string, prefix: string) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), rel);
      else out.push(rel.split(path.sep).join("/"));
    }
  };
  walk(dir, "");
  return out.sort();
}

describe("SaveService.importSave", () => {
  beforeEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  describe("verified imports", () => {
    it("installs a valid PS1 memory card under the name DuckStation looks for", async () => {
      const ps1 = game({
        consoleId: "ps1",
        engineId: "duckstation",
        filePath: path.join(ROMS_DIR, "ps1", "Jackie Chan Stuntmaster (USA).bin"),
      });

      const result = await SaveService.importSave(ps1, inbox("someone-elses-card.mcd", buildPs1Card()));

      expect(result.success).toBe(true);
      expect(result.importedFiles).toEqual(["Jackie Chan Stuntmaster (USA)_1.mcd"]);
      // Written to both the cache and DuckStation's own memcards directory.
      expect(filesUnder(path.join(CACHE_DIR, "ps1"))).toEqual(["Jackie Chan Stuntmaster (USA)_1.mcd"]);
      expect(filesUnder(path.join(EMU_DIR, "duckstation", "memcards"))).toEqual([
        "Jackie Chan Stuntmaster (USA)_1.mcd",
      ]);
    });

    it("renames a cartridge save to the game it was imported onto", async () => {
      const gb = game({
        consoleId: "gb",
        engineId: "mesen",
        filePath: path.join(ROMS_DIR, "gb", "Pokemon - Blue Version.gb"),
      });

      const result = await SaveService.importSave(gb, inbox("pokeblue.srm", Buffer.alloc(32 * 1024)));

      expect(result.success).toBe(true);
      expect(result.importedFiles).toEqual(["Pokemon - Blue Version.srm"]);
    });

    it("keeps a Mesen save state's slot number", async () => {
      const nes = game({
        consoleId: "nes",
        engineId: "mesen",
        filePath: path.join(ROMS_DIR, "nes", "Punch-Out!!.nes"),
      });

      const result = await SaveService.importSave(nes, inbox("whatever_7.mss", buildMesenState()));

      expect(result.importedFiles).toEqual(["Punch-Out!!_7.mss"]);
    });

    it("files a GameCube save into the card folder for its region", async () => {
      const gc = game({ consoleId: "gc", engineId: "dolphin" });

      const result = await SaveService.importSave(gc, inbox("01-GM4E-save.gci", buildGci()));

      expect(result.success).toBe(true);
      expect(filesUnder(path.join(EMU_DIR, "dolphin", "GC"))).toEqual(["USA/Card A/01-GM4E-save.gci"]);
    });

    it("accepts GameCube system SRAM by its size and signature", async () => {
      const gc = game({ consoleId: "gc", engineId: "dolphin" });
      const sram = Buffer.alloc(68);
      sram.write("DOLPHINS", 0x18, "latin1");

      const result = await SaveService.importSave(gc, inbox("SRAM.raw", sram));

      expect(result.success).toBe(true);
      expect(result.importedFiles).toEqual(["SRAM.raw"]);
    });

    it("takes a PS2 card into slot 1", async () => {
      const ps2 = game({ consoleId: "ps2", engineId: "pcsx2" });

      const result = await SaveService.importSave(ps2, inbox("backup.ps2", buildPs2Card()));

      expect(result.importedFiles).toEqual(["Mcd001.ps2"]);
    });

    it("accepts a 3DS save archive with the expected SD card structure", async () => {
      const threeds = game({ consoleId: "3ds", engineId: "azahar" });
      const id = "0".repeat(32);
      const zipPath = archive("mk7.zip", {
        [`sdmc/Nintendo 3DS/${id}/${id}/title/00040000/00030800/data/00000001/system5.dat`]: Buffer.from("save"),
        [`nand-data/${id}/sysdata/00010017/00000000/config`]: Buffer.from("cfg"),
      });

      const result = await SaveService.importSave(threeds, zipPath);

      expect(result.success).toBe(true);
      expect(result.importedFiles).toHaveLength(2);
      expect(filesUnder(path.join(EMU_DIR, "azahar", "sdmc")).some(f => f.endsWith("system5.dat"))).toBe(true);
    });
  });

  describe("rejections", () => {
    async function expectRejected(g: Game, sourcePath: string) {
      const result = await SaveService.importSave(g, sourcePath);
      expect(result.success).toBe(false);
      expect(result.issues?.length).toBeGreaterThan(0);
      // Nothing is written unless the whole import verifies.
      expect(filesUnder(CACHE_DIR)).toEqual([]);
      expect(filesUnder(EMU_DIR)).toEqual([]);
      return result;
    }

    it("rejects a PS1 card whose directory checksums do not add up", async () => {
      const ps1 = game({ consoleId: "ps1", engineId: "duckstation" });
      const corrupt = buildPs1Card();
      corrupt[64] = 0xff; // flips a byte the frame checksum covers

      const result = await expectRejected(ps1, inbox("corrupt.mcd", corrupt));
      expect(result.error).toContain("checksum");
    });

    it("rejects a memory card of the wrong size", async () => {
      const ps1 = game({ consoleId: "ps1", engineId: "duckstation" });
      const result = await expectRejected(ps1, inbox("truncated.mcd", buildPs1Card().subarray(0, 64 * 1024)));
      expect(result.error).toContain("128 KB");
    });

    it("rejects a PS2 card without the Sony header", async () => {
      const ps2 = game({ consoleId: "ps2", engineId: "pcsx2" });
      const result = await expectRejected(ps2, inbox("fake.ps2", Buffer.alloc((8 * 1024 * 1024 * 33) / 32)));
      expect(result.error).toContain("Sony PS2 Memory Card Format");
    });

    it("rejects a GCI whose header disagrees with its length", async () => {
      const gc = game({ consoleId: "gc", engineId: "dolphin" });
      const lying = buildGci(3);
      lying.writeUInt16BE(9, 0x38);

      const result = await expectRejected(gc, inbox("lying.gci", lying));
      expect(result.error).toContain("declares 9 block(s)");
    });

    it("rejects a GameCube save from an unmapped region", async () => {
      const gc = game({ consoleId: "gc", engineId: "dolphin" });
      const result = await expectRejected(gc, inbox("01-GM4X-save.gci", buildGci(3, "GM4X")));
      expect(result.error).toContain("region");
    });

    it("rejects a cartridge save that is not a real chip size", async () => {
      const gba = game({ consoleId: "gba", engineId: "mesen" });
      const result = await expectRejected(gba, inbox("odd.srm", Buffer.alloc(1234)));
      expect(result.error).toContain("not a valid save chip size");
    });

    it("rejects a file whose extension this console never uses", async () => {
      const gb = game({ consoleId: "gb", engineId: "mesen" });
      const result = await expectRejected(gb, inbox("notes.txt", Buffer.alloc(2048)));
      expect(result.error).toContain("not a save format this console uses");
    });

    it("rejects an empty file", async () => {
      const gb = game({ consoleId: "gb", engineId: "mesen" });
      const result = await expectRejected(gb, inbox("empty.srm", Buffer.alloc(0)));
      expect(result.error).toContain("empty");
    });

    it("refuses a bare file for consoles whose saves are whole filesystems", async () => {
      const wii = game({ consoleId: "wii", engineId: "dolphin" });
      const result = await expectRejected(wii, inbox("banner.bin", Buffer.from("WIBN")));
      expect(result.error).toContain("save archive");
    });

    it("rejects archive entries outside a known save folder", async () => {
      const threeds = game({ consoleId: "3ds", engineId: "azahar" });
      const zipPath = archive("odd.zip", { "roms/game.3ds": Buffer.from("not a save") });

      const result = await expectRejected(threeds, zipPath);
      expect(result.error).toContain("not a save folder");
    });

    it("rejects 3DS data that is not in a real save location", async () => {
      const threeds = game({ consoleId: "3ds", engineId: "azahar" });
      const zipPath = archive("odd.zip", { "sdmc/Nintendo 3DS/nonsense/payload.bin": Buffer.from("x") });

      const result = await expectRejected(threeds, zipPath);
      expect(result.error).toContain("can verify");
    });

    it("rejects an archive that tries to escape the save folder", async () => {
      const threeds = game({ consoleId: "3ds", engineId: "azahar" });

      const result = await expectRejected(threeds, archiveWithTraversalEntry("evil.zip"));

      expect(result.error).toContain("outside");
      expect(fs.existsSync(path.resolve(TEMP_DIR, "../../evil.sh"))).toBe(false);
    });

    it("rejects an archive belonging to a different game", async () => {
      const gb = game({
        consoleId: "gb",
        engineId: "mesen",
        filePath: path.join(ROMS_DIR, "gb", "Pokemon - Blue Version.gb"),
      });
      const zipPath = archive("other.zip", { "saves/Tetris.srm": Buffer.alloc(32 * 1024) });

      const result = await expectRejected(gb, zipPath);
      expect(result.error).toContain("different game");
    });

    it("writes nothing when one entry of an archive fails verification", async () => {
      const threeds = game({ consoleId: "3ds", engineId: "azahar" });
      const id = "0".repeat(32);
      const zipPath = archive("mixed.zip", {
        [`sdmc/Nintendo 3DS/${id}/${id}/title/00040000/00030800/data/00000001/system5.dat`]: Buffer.from("good"),
        "sdmc/whatever/payload.bin": Buffer.from("bad"),
      });

      await expectRejected(threeds, zipPath);
    });
  });

  describe("round trip with export", () => {
    it("imports an archive RomBox exported for the same game", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { dialog } = require("electron");
      const wii = game({ consoleId: "wii", engineId: "dolphin" });

      const nandFile = path.join(
        EMU_DIR, "dolphin", "Wii", "title", "00010000", "524d4345", "data", "rksys.dat",
      );
      fs.mkdirSync(path.dirname(nandFile), { recursive: true });
      fs.writeFileSync(nandFile, "wii save data");
      SaveService.backupSave(wii);

      const exportPath = path.join(TEMP_DIR, "wii-export.zip");
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({ canceled: false, filePath: exportPath });
      const exported = await SaveService.exportSave(wii);
      expect(exported.success).toBe(true);

      // Wipe the NAND, then put it back from the export.
      fs.rmSync(path.join(EMU_DIR, "dolphin", "Wii"), { recursive: true, force: true });
      fs.rmSync(path.join(CACHE_DIR, "wii"), { recursive: true, force: true });

      const imported = await SaveService.importSave(wii, exportPath);

      expect(imported.success).toBe(true);
      expect(fs.readFileSync(nandFile, "utf-8")).toBe("wii save data");
    });
  });

  describe("replacing existing saves", () => {
    it("keeps a copy of whatever it overwrites", async () => {
      const ps1 = game({ consoleId: "ps1", engineId: "duckstation" });
      const existing = path.join(EMU_DIR, "duckstation", "memcards", "Test Game_1.mcd");
      fs.mkdirSync(path.dirname(existing), { recursive: true });
      fs.writeFileSync(existing, "the card that was already there");

      const result = await SaveService.importSave(ps1, inbox("new.mcd", buildPs1Card()));

      expect(result.success).toBe(true);
      expect(result.replacedTo).toBeTruthy();
      const replaced = path.join(String(result.replacedTo), "emulator", "memcards", "Test Game_1.mcd");
      expect(fs.readFileSync(replaced, "utf-8")).toBe("the card that was already there");
    });

    it("leaves no snapshot when nothing was overwritten", async () => {
      const ps1 = game({ consoleId: "ps1", engineId: "duckstation" });
      const result = await SaveService.importSave(ps1, inbox("new.mcd", buildPs1Card()));

      expect(result.success).toBe(true);
      expect(result.replacedTo).toBeUndefined();
    });
  });
});
