// install, cache-restore and delete run against a real temp filesystem so the
// directory-based (azahar) and file-based paths are both exercised.
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

import { BiosService } from "../../../../src/main/services/BiosService";
import { suiteUserDataDir } from "../../../helpers/tempDirs";

const EMU_ROOT = path.join(suiteUserDataDir(), "emu");

jest.mock("../../../../src/main/platform", () => {
  const p = jest.requireActual("path");
  return {
    osHandler: {
      getEmulatorBasePath: (engineId: string) =>
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        p.join(require("../../../helpers/tempDirs").suiteUserDataDir(), "emu", engineId),
    },
  };
});

function biosDirs(consoleId: string) {
  const { CONSOLES } = jest.requireActual("../../../../src/main/config/consoles");
  return {
    firmwareDir: CONSOLES[consoleId].bios.installDir as string,
    cacheDir: path.join(suiteUserDataDir(), "bios", consoleId),
  };
}

beforeEach(() => {
  fs.rmSync(suiteUserDataDir(), { recursive: true, force: true });
  fs.mkdirSync(EMU_ROOT, { recursive: true });
});

afterAll(() => {
  fs.rmSync(suiteUserDataDir(), { recursive: true, force: true });
});

describe("installBios", () => {
  it("installs a loose bios file into both the emulator dir and the cache", async () => {
    const src = path.join(suiteUserDataDir(), "scph1001.bin");
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.writeFileSync(src, "bios-bytes");

    const result = await BiosService.installBios("ps1", src);

    expect(result.success).toBe(true);
    expect(result.installed).toEqual(["scph1001.bin"]);

    const { firmwareDir, cacheDir } = biosDirs("ps1");
    expect(fs.readFileSync(path.join(firmwareDir, "scph1001.bin"), "utf-8")).toBe("bios-bytes");
    expect(fs.readFileSync(path.join(cacheDir, "scph1001.bin"), "utf-8")).toBe("bios-bytes");
  });

  it("extracts recognised bios files out of a zip", async () => {
    const zipPath = path.join(suiteUserDataDir(), "bios.zip");
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    const zip = new AdmZip();
    zip.addFile("scph5500.bin", Buffer.from("japan"));
    zip.addFile("readme.txt", Buffer.from("ignore me"));
    zip.writeZip(zipPath);

    const result = await BiosService.installBios("ps1", zipPath);

    expect(result.installed).toEqual(["scph5500.bin"]);
    const { firmwareDir } = biosDirs("ps1");
    expect(fs.existsSync(path.join(firmwareDir, "readme.txt"))).toBe(false);
  });

  it("rejects a file that is not a known bios for the console", async () => {
    const src = path.join(suiteUserDataDir(), "notabios.bin");
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.writeFileSync(src, "x");

    await expect(BiosService.installBios("ps1", src)).rejects.toThrow(/not a valid BIOS/);
  });

  it("rejects a console that needs no bios", async () => {
    await expect(BiosService.installBios("nes", "/tmp/whatever")).rejects.toThrow(
      /does not require a BIOS/
    );
  });

  it("rejects a zip with nothing usable in it", async () => {
    const zipPath = path.join(suiteUserDataDir(), "empty.zip");
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    const zip = new AdmZip();
    zip.addFile("notes.txt", Buffer.from("nope"));
    zip.writeZip(zipPath);

    await expect(BiosService.installBios("ps1", zipPath)).rejects.toThrow(/No valid BIOS files/);
  });

  describe("directory-based system data", () => {
    function makeUserFolder(root: string) {
      for (const dir of ["nand", "sysdata", "sdmc"]) {
        fs.mkdirSync(path.join(root, dir), { recursive: true });
        fs.writeFileSync(path.join(root, dir, "file.bin"), dir);
      }
    }

    it("merges each system directory into the emulator dir and cache", async () => {
      const userDir = path.join(suiteUserDataDir(), "user");
      makeUserFolder(userDir);

      const result = await BiosService.installBios("3ds", userDir);

      expect(result.installed).toEqual(["nand", "sysdata", "sdmc"]);
      const { firmwareDir, cacheDir } = biosDirs("3ds");
      expect(fs.readFileSync(path.join(firmwareDir, "nand", "file.bin"), "utf-8")).toBe("nand");
      expect(fs.readFileSync(path.join(cacheDir, "sdmc", "file.bin"), "utf-8")).toBe("sdmc");
    });

    it("rejects a folder that is not named user", async () => {
      const wrong = path.join(suiteUserDataDir(), "azahar");
      makeUserFolder(wrong);
      await expect(BiosService.installBios("3ds", wrong)).rejects.toThrow(/'user' folder/);
    });

    it("rejects a user folder missing every system directory", async () => {
      const empty = path.join(suiteUserDataDir(), "user");
      fs.mkdirSync(empty, { recursive: true });
      await expect(BiosService.installBios("3ds", empty)).rejects.toThrow(/Invalid user folder/);
    });

    it("does not overwrite files already installed", async () => {
      const { firmwareDir } = biosDirs("3ds");
      fs.mkdirSync(path.join(firmwareDir, "nand"), { recursive: true });
      fs.writeFileSync(path.join(firmwareDir, "nand", "file.bin"), "existing");

      const userDir = path.join(suiteUserDataDir(), "user");
      makeUserFolder(userDir);
      await BiosService.installBios("3ds", userDir);

      expect(fs.readFileSync(path.join(firmwareDir, "nand", "file.bin"), "utf-8")).toBe("existing");
    });
  });
});

describe("ensureBiosInstalledFromCache", () => {
  it("copies cached files the emulator dir is missing", () => {
    const { firmwareDir, cacheDir } = biosDirs("ps1");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "scph1001.bin"), "cached");

    const result = BiosService.ensureBiosInstalledFromCache("ps1");

    expect(result.copied).toContain("scph1001.bin");
    expect(fs.readFileSync(path.join(firmwareDir, "scph1001.bin"), "utf-8")).toBe("cached");
  });

  it("leaves an already-installed file alone", () => {
    const { firmwareDir, cacheDir } = biosDirs("ps1");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.mkdirSync(firmwareDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "scph1001.bin"), "cached");
    fs.writeFileSync(path.join(firmwareDir, "scph1001.bin"), "installed");

    const result = BiosService.ensureBiosInstalledFromCache("ps1");

    expect(result.copied).not.toContain("scph1001.bin");
    expect(fs.readFileSync(path.join(firmwareDir, "scph1001.bin"), "utf-8")).toBe("installed");
  });

  it("reports files absent from the cache as missing", () => {
    const result = BiosService.ensureBiosInstalledFromCache("ds");
    expect(result.copied).toEqual([]);
    expect(result.missing).toEqual(["bios7.bin", "bios9.bin", "firmware.bin"]);
  });

  it("restores system directories for a directory-based console", () => {
    const { firmwareDir, cacheDir } = biosDirs("3ds");
    fs.mkdirSync(path.join(cacheDir, "nand"), { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "nand", "f.bin"), "cached");

    const result = BiosService.ensureBiosInstalledFromCache("3ds");

    expect(result.copied).toContain("nand");
    expect(result.missing).toEqual(expect.arrayContaining(["sysdata", "sdmc"]));
    expect(fs.readFileSync(path.join(firmwareDir, "nand", "f.bin"), "utf-8")).toBe("cached");
  });

  it("does nothing for a console with no bios", () => {
    expect(BiosService.ensureBiosInstalledFromCache("nes")).toEqual({ copied: [], missing: [] });
  });
});

describe("deleteBios", () => {
  it("removes the file from both the emulator dir and the cache", async () => {
    const { firmwareDir, cacheDir } = biosDirs("ps1");
    fs.mkdirSync(firmwareDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(firmwareDir, "scph1001.bin"), "x");
    fs.writeFileSync(path.join(cacheDir, "scph1001.bin"), "x");

    const result = await BiosService.deleteBios("ps1", "scph1001.bin");

    expect(result.deleted).toBe(2);
    expect(fs.existsSync(path.join(firmwareDir, "scph1001.bin"))).toBe(false);
    expect(fs.existsSync(path.join(cacheDir, "scph1001.bin"))).toBe(false);
  });

  it("refuses a filename the console does not recognise", async () => {
    await expect(BiosService.deleteBios("ps1", "evil.bin")).rejects.toThrow(/not a known BIOS/);
  });

  it("refuses a console with no bios", async () => {
    await expect(BiosService.deleteBios("nes", "x.bin")).rejects.toThrow(
      /does not require a BIOS/
    );
  });

  it("reports zero deletions when the file was never installed", async () => {
    const result = await BiosService.deleteBios("ps1", "scph5502.bin");
    expect(result.deleted).toBe(0);
    expect(result.success).toBe(true);
  });
});

describe("getAllBiosStatus", () => {
  it("returns one entry per console that declares a bios", () => {
    const all = BiosService.getAllBiosStatus();
    const ids = all.map((s) => s.consoleId).sort();

    expect(ids).toEqual(["3ds", "ds", "gba", "ps1", "ps2", "snes"]);
    // consoles without firmware are absent entirely
    expect(ids).not.toContain("nes");
  });
});
