// the zip helpers run against real archives; they drive yauzl streams, which a
// mock would not exercise meaningfully.
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

import {
  extractZipEntry,
  readZipEntryHeader,
  scanZipEntries,
  findFile,
  resolveBinaryPath,
} from "../../../../src/main/utils/fsUtils";
import { suiteTempDir } from "../../../helpers/tempDirs";

const ROOT = suiteTempDir();

function makeZip(name: string, entries: Array<[string, Buffer | string]>): string {
  const zip = new AdmZip();
  for (const [entryName, data] of entries) {
    zip.addFile(entryName, Buffer.isBuffer(data) ? data : Buffer.from(data));
  }
  const p = path.join(ROOT, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  zip.writeZip(p);
  return p;
}

beforeEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });
});

afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));

describe("scanZipEntries", () => {
  it("lists files and their sizes", async () => {
    const zip = makeZip("a.zip", [["game.nes", "0123456789"], ["notes.txt", "hi"]]);

    const entries = await scanZipEntries(zip);

    expect(entries).toEqual(
      expect.arrayContaining([
        { fileName: "game.nes", uncompressedSize: 10 },
        { fileName: "notes.txt", uncompressedSize: 2 },
      ])
    );
  });

  it("skips directory entries", async () => {
    const zip = new AdmZip();
    zip.addFile("roms/", Buffer.alloc(0));
    zip.addFile("roms/game.nes", Buffer.from("x"));
    const p = path.join(ROOT, "dirs.zip");
    zip.writeZip(p);

    const entries = await scanZipEntries(p);
    expect(entries.map((e) => e.fileName)).toEqual(["roms/game.nes"]);
  });

  it("rejects a file that is not a zip", async () => {
    const bogus = path.join(ROOT, "nope.zip");
    fs.writeFileSync(bogus, "not a zip");
    await expect(scanZipEntries(bogus)).rejects.toBeDefined();
  });
});

describe("readZipEntryHeader", () => {
  it("reads the leading bytes of an entry", async () => {
    const zip = makeZip("h.zip", [["game.nes", Buffer.from([0x4e, 0x45, 0x53, 0x1a, 0xff])]]);

    const header = await readZipEntryHeader(zip, "game.nes");
    expect(header.subarray(0, 4)).toEqual(Buffer.from([0x4e, 0x45, 0x53, 0x1a]));
  });

  it("truncates to maxBytes", async () => {
    const zip = makeZip("big.zip", [["game.nes", Buffer.alloc(5000, 7)]]);

    const header = await readZipEntryHeader(zip, "game.nes", 16);
    expect(header.length).toBe(16);
  });

  it("matches on basename when the entry is nested", async () => {
    const zip = makeZip("nested.zip", [["roms/nes/game.nes", "abcd"]]);

    const header = await readZipEntryHeader(zip, "game.nes");
    expect(header.toString()).toBe("abcd");
  });

  it("accepts backslash separators in the requested name", async () => {
    const zip = makeZip("win.zip", [["roms/game.nes", "abcd"]]);

    const header = await readZipEntryHeader(zip, "roms\\game.nes");
    expect(header.toString()).toBe("abcd");
  });

  it("rejects when the entry is absent", async () => {
    const zip = makeZip("missing.zip", [["other.nes", "x"]]);
    await expect(readZipEntryHeader(zip, "game.nes")).rejects.toThrow(/not found in zip/);
  });
});

describe("extractZipEntry", () => {
  it("writes the entry to disk", async () => {
    const zip = makeZip("e.zip", [["bios.bin", "bios-bytes"]]);
    const dest = path.join(ROOT, "out", "bios.bin");
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    await extractZipEntry(zip, "bios.bin", dest);

    expect(fs.readFileSync(dest, "utf-8")).toBe("bios-bytes");
  });

  it("finds a nested entry by basename", async () => {
    const zip = makeZip("en.zip", [["deep/dir/bios.bin", "nested"]]);
    const dest = path.join(ROOT, "out2", "bios.bin");
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    await extractZipEntry(zip, "bios.bin", dest);
    expect(fs.readFileSync(dest, "utf-8")).toBe("nested");
  });

  it("rejects when the entry is absent", async () => {
    const zip = makeZip("em.zip", [["other.bin", "x"]]);
    const dest = path.join(ROOT, "out3", "bios.bin");
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    await expect(extractZipEntry(zip, "bios.bin", dest)).rejects.toThrow(/not found in zip/);
  });

  it("rejects when the destination cannot be written", async () => {
    const zip = makeZip("ew.zip", [["bios.bin", "x"]]);
    await expect(
      extractZipEntry(zip, "bios.bin", path.join(ROOT, "no", "such", "dir", "bios.bin"))
    ).rejects.toBeDefined();
  });
});

describe("findFile", () => {
  it("finds a file in the top directory", () => {
    fs.writeFileSync(path.join(ROOT, "target.txt"), "x");
    expect(findFile(ROOT, "target.txt")).toBe(path.join(ROOT, "target.txt"));
  });

  it("descends into subdirectories", () => {
    const deep = path.join(ROOT, "a", "b", "c");
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, "target.txt"), "x");

    expect(findFile(ROOT, "target.txt")).toBe(path.join(deep, "target.txt"));
  });

  it("returns null when nothing matches", () => {
    expect(findFile(ROOT, "absent.txt")).toBeNull();
  });

  it("returns null for a directory that does not exist", () => {
    expect(findFile(path.join(ROOT, "nope"), "x.txt")).toBeNull();
  });

  it("does not follow symlinked directories", () => {
    const real = path.join(ROOT, "real");
    fs.mkdirSync(real, { recursive: true });
    fs.writeFileSync(path.join(real, "target.txt"), "x");
    fs.symlinkSync(real, path.join(ROOT, "link"), "dir");

    // the real directory is still found; the symlink is not descended into
    expect(findFile(ROOT, "target.txt")).toBe(path.join(real, "target.txt"));
  });
});

describe("resolveBinaryPath", () => {
  it("prefers the configured relative path", async () => {
    const nested = path.join(ROOT, "Mesen.app", "Contents", "MacOS");
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, "Mesen"), "");

    const resolved = await resolveBinaryPath(ROOT, "Mesen.app/Contents/MacOS/Mesen");
    expect(resolved).toBe(path.join(nested, "Mesen"));
  });

  it("falls back to searching by basename when the layout differs", async () => {
    // archives sometimes nest everything one level deeper than expected
    const actual = path.join(ROOT, "extracted", "Mesen.app", "Contents", "MacOS");
    fs.mkdirSync(actual, { recursive: true });
    fs.writeFileSync(path.join(actual, "Mesen"), "");

    const resolved = await resolveBinaryPath(ROOT, "Mesen.app/Contents/MacOS/Mesen");
    expect(resolved).toBe(path.join(actual, "Mesen"));
  });

  it("throws when the binary is nowhere in the install dir", async () => {
    await expect(resolveBinaryPath(ROOT, "some/path/Missing")).rejects.toThrow(
      /Missing not found/
    );
  });
});
