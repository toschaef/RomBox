// both bios status entry points feed this calculation; only the "which files
// count as required" decision differs.
import fs from "fs";
import path from "path";
import os from "os";

import {
  computeBiosStatus,
  directoryBiosStatus,
  noBiosStatus,
} from "../../../../src/main/services/bios/biosStatus";
import { azaharSystemBios } from "../../../../src/main/emulators/azahar/bios";
import type { BiosFile } from "../../../../src/shared/types/bios";

jest.mock("electron", () => ({
  app: { getPath: jest.fn().mockReturnValue("/mock/userData") },
}));

let firmwareDir: string;
let cacheDir: string;

const file = (filename: string, extra: Partial<BiosFile> = {}): BiosFile => ({
  filename,
  description: filename,
  ...extra,
});

function place(dir: string, name: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), "x");
}

beforeEach(() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rombox-bios-"));
  firmwareDir = path.join(root, "firmware");
  cacheDir = path.join(root, "cache");
  fs.mkdirSync(firmwareDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
});

describe("computeBiosStatus", () => {
  const psFiles = [file("scph1001.bin"), file("scph5500.bin"), file("scph5502.bin")];

  function ps1(overrides = {}) {
    return computeBiosStatus({
      consoleId: "ps1",
      files: psFiles,
      required: true,
      onlyNeedOne: true,
      requiredFiles: psFiles,
      warningFiles: [],
      firmwareDir,
      cacheDir,
      ...overrides,
    });
  }

  describe("when any one file suffices", () => {
    it("is satisfied by a single regional dump", () => {
      place(firmwareDir, "scph5502.bin");

      const status = ps1();
      expect(status.biosState).toBe("ok");
      expect(status.missingRequiredFiles).toEqual([]);
      expect(status.needsBios).toBe(true);
    });

    it("reports every candidate as missing when none is present", () => {
      const status = ps1();
      expect(status.biosState).toBe("missing");
      expect(status.missingRequiredFiles).toEqual([
        "scph1001.bin",
        "scph5500.bin",
        "scph5502.bin",
      ]);
    });

    it("downgrades to a warning when the BIOS is optional", () => {
      const status = ps1({ required: false });
      expect(status.biosState).toBe("warning");
      expect(status.missingRequiredFiles).toEqual([]);
      expect(status.missingWarningFiles).toHaveLength(3);
      expect(status.needsBios).toBe(false);
    });

    it("tracks the cache independently of what is installed", () => {
      place(firmwareDir, "scph1001.bin");
      expect(ps1().cachedComplete).toBe(false);

      place(cacheDir, "scph5500.bin");
      const status = ps1();
      expect(status.cachedComplete).toBe(true);
      expect(status.cachedFiles).toEqual(["scph5500.bin"]);
    });
  });

  describe("when every file is needed", () => {
    const dsFiles = [file("bios7.bin"), file("bios9.bin"), file("firmware.bin")];

    function ds(overrides = {}) {
      return computeBiosStatus({
        consoleId: "ds",
        files: dsFiles,
        required: true,
        onlyNeedOne: false,
        requiredFiles: dsFiles,
        warningFiles: [],
        firmwareDir,
        cacheDir,
        ...overrides,
      });
    }

    it("lists only the files actually absent", () => {
      place(firmwareDir, "bios7.bin");

      const status = ds();
      expect(status.biosState).toBe("missing");
      expect(status.missingRequiredFiles).toEqual(["bios9.bin", "firmware.bin"]);
    });

    it("is ok once all files are present", () => {
      for (const f of dsFiles) place(firmwareDir, f.filename);
      expect(ds().biosState).toBe("ok");
    });

    it("treats missing warning-level files as a warning, not a failure", () => {
      for (const f of dsFiles) place(firmwareDir, f.filename);

      const status = ds({
        requiredFiles: dsFiles,
        warningFiles: [file("optional.rom", { level: "warning" })],
      });

      expect(status.biosState).toBe("warning");
      expect(status.missingWarningFiles).toEqual(["optional.rom"]);
    });

    it("needs no BIOS when nothing is required", () => {
      const status = ds({ required: false, requiredFiles: [], warningFiles: dsFiles });
      expect(status.needsBios).toBe(false);
    });

    it("forces the requirement for a game that needs specific firmware", () => {
      // a SNES cartridge with a DSP chip requires it even though the console
      // as a whole marks firmware optional.
      const status = ds({
        required: false,
        forceRequired: true,
        requiredFiles: [file("dsp1.rom", { gameSpecific: true })],
        warningFiles: [],
      });

      expect(status.needsBios).toBe(true);
      expect(status.biosState).toBe("missing");
      expect(status.missingRequiredFiles).toEqual(["dsp1.rom"]);
    });
  });

  it("reports 'none' for an empty file list", () => {
    const status = computeBiosStatus({
      consoleId: "nes",
      files: [],
      required: true,
      onlyNeedOne: false,
      requiredFiles: [],
      warningFiles: [],
      firmwareDir,
      cacheDir,
    });

    expect(status.biosState).toBe("none");
    expect(status.needsBios).toBe(false);
  });
});

describe("noBiosStatus", () => {
  it("describes a console that needs no firmware", () => {
    const status = noBiosStatus("nes", { firmwareDir, cacheDir });
    expect(status).toMatchObject({
      consoleId: "nes",
      engineId: "mesen",
      needsBios: false,
      biosState: "none",
      cachedComplete: true,
      required: false,
    });
  });
});

describe("directoryBiosStatus", () => {
  it("warns about the system directories that are absent", () => {
    fs.mkdirSync(path.join(firmwareDir, "nand"), { recursive: true });

    const status = directoryBiosStatus("3ds", azaharSystemBios, { firmwareDir, cacheDir });

    expect(status.biosState).toBe("warning");
    expect(status.missingWarningFiles).toEqual(["sysdata", "sdmc"]);
    // system data is optional, so nothing is ever "required".
    expect(status.missingRequiredFiles).toEqual([]);
    expect(status.required).toBe(false);
  });

  it("is ok once every directory is present", () => {
    for (const dir of azaharSystemBios.dirs) {
      fs.mkdirSync(path.join(firmwareDir, dir), { recursive: true });
    }

    const status = directoryBiosStatus("3ds", azaharSystemBios, { firmwareDir, cacheDir });
    expect(status.biosState).toBe("ok");
    expect(status.missingWarningFiles).toEqual([]);
  });

  it("reports which directories are cached", () => {
    fs.mkdirSync(path.join(cacheDir, "sdmc"), { recursive: true });

    const status = directoryBiosStatus("3ds", azaharSystemBios, { firmwareDir, cacheDir });
    expect(status.cachedFiles).toEqual(["sdmc"]);
    expect(status.engineId).toBe("azahar");
  });
});
