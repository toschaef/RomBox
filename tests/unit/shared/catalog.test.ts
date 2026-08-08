// assertions are written longhand rather than computed, so a careless catalog
// edit fails here instead of silently changing what rombox identifies.
import { CONSOLES } from "../../../src/main/config/consoles";
import { ENGINES } from "../../../src/main/config/engines";
import {
  CONSOLE_CATALOG,
  CONSOLE_IDS,
  ENGINE_CATALOG,
  ENGINE_IDS,
} from "../../../src/shared/emulators/catalog";
import {
  BIOS_FILENAMES,
  CONSOLEID_ENGLISH_MAP,
  EXTENSION_MAP,
  SIGNATURES,
  getBiosFiles,
  getConsoleIdFromExtension,
  getConsoleIdsForEngine,
  getConsoleNameFromId,
  getEmulatorNameFromConsoleID,
  getEmulatorNameFromEngineId,
  getEngineIdFromConsoleId,
  isAmbiguousExtension,
} from "../../../src/shared/emulators/derived";
import type { ConsoleID } from "../../../src/shared/types";

describe("emulator catalog", () => {
  it("declares every console and engine exactly once", () => {
    expect(CONSOLE_IDS).toEqual([
      "nes", "snes", "gb", "gba", "gg", "sms", "pce",
      "n64", "ds", "3ds", "gc", "wii", "ps1", "ps2",
    ]);
    expect(ENGINE_IDS.sort()).toEqual([
      "ares", "azahar", "dolphin", "duckstation", "melonds", "mesen", "pcsx2",
    ]);
  });

  it("maps every console to an engine that exists", () => {
    for (const id of CONSOLE_IDS) {
      expect(ENGINE_CATALOG[getEngineIdFromConsoleId(id)]).toBeDefined();
    }
  });

  it("assigns every engine at least one console", () => {
    for (const engineId of ENGINE_IDS) {
      expect(getConsoleIdsForEngine(engineId).length).toBeGreaterThan(0);
    }
  });
});

describe("display names", () => {
  it("names consoles", () => {
    expect(CONSOLEID_ENGLISH_MAP).toEqual({
      nes: "NES",
      gg: "GameGear",
      sms: "Sega Master System",
      pce: "PC Engine",
      snes: "SNES",
      gb: "Game Boy",
      gba: "Game Boy Advance",
      n64: "N64",
      ds: "DS",
      "3ds": "3DS",
      gc: "GameCube",
      wii: "Wii",
      ps1: "PS1",
      ps2: "PS2",
    });
    expect(getConsoleNameFromId("gc")).toBe("GameCube");
  });

  it("names emulators by engine and by console", () => {
    expect(getEmulatorNameFromEngineId("mesen")).toBe("Mesen 2");
    expect(getEmulatorNameFromEngineId("pcsx2")).toBe("PCSX2");
    expect(getEmulatorNameFromConsoleID("wii")).toBe("Dolphin");
    expect(getEmulatorNameFromConsoleID("nes")).toBe("Mesen 2");
  });
});

describe("extension identification", () => {
  it("resolves unambiguous extensions to a console", () => {
    expect(EXTENSION_MAP).toEqual({
      ".nes": "nes", ".unf": "nes",
      ".sfc": "snes", ".smc": "snes", ".snes": "snes",
      ".gb": "gb", ".gbc": "gb",
      ".gba": "gba",
      ".gg": "gg",
      ".sms": "sms",
      ".pce": "pce", ".sgx": "pce",
      ".n64": "n64", ".z64": "n64", ".v64": "n64",
      ".nds": "ds",
      ".3ds": "3ds", ".cia": "3ds", ".cxi": "3ds",
    });
  });

  it("treats extensions shared by several consoles as ambiguous", () => {
    for (const ext of [".iso", ".bin", ".chd", ".rvz"]) {
      expect(isAmbiguousExtension(ext)).toBe(true);
      expect(getConsoleIdFromExtension(ext)).toBeNull();
    }
  });

  it("does not identify a console from an archive extension", () => {
    // `.zip` is accepted for DS/3DS but resolved by inspecting entries.
    expect(getConsoleIdFromExtension(".zip")).toBeUndefined();
  });

  it("is case insensitive", () => {
    expect(getConsoleIdFromExtension(".NES")).toBe("nes");
    expect(getConsoleIdFromExtension(".ISO")).toBeNull();
  });
});

describe("BIOS files", () => {
  it("maps every catalogued BIOS filename to its console", () => {
    expect(BIOS_FILENAMES["scph1001.bin"]).toBe("ps1");
    expect(BIOS_FILENAMES["scph30001.bin"]).toBe("ps2");
    expect(BIOS_FILENAMES["scph30004.bin"]).toBe("ps2");
    expect(BIOS_FILENAMES["bios.bin"]).toBe("ps2");
    expect(BIOS_FILENAMES["bios7.bin"]).toBe("ds");
    expect(BIOS_FILENAMES["gba_bios.bin"]).toBe("gba");
  });

  it("marks the PlayStation BIOSes as satisfiable by any one file", () => {
    for (const id of ["ps1", "ps2"] as ConsoleID[]) {
      expect(CONSOLE_CATALOG[id].bios?.required).toBe(true);
      expect(CONSOLE_CATALOG[id].bios?.onlyNeedOne).toBe(true);
    }
  });

  it("leaves consoles without firmware requirements BIOS-free", () => {
    for (const id of ["nes", "gb", "gg", "sms", "pce", "n64", "gc", "wii"] as ConsoleID[]) {
      expect(getBiosFiles(id)).toEqual([]);
      expect(CONSOLES[id].bios).toBeUndefined();
    }
  });
});

describe("main-process CONSOLES is built from the catalog", () => {
  it("carries the catalog's extensions and BIOS files verbatim", () => {
    for (const id of CONSOLE_IDS) {
      expect(CONSOLES[id].acceptedExtensions).toEqual(CONSOLE_CATALOG[id].extensions);
      expect(CONSOLES[id].bios?.files ?? []).toEqual(getBiosFiles(id));
    }
  });

  it("uses .sgx for PC Engine, not the historical typo", () => {
    expect(CONSOLES.pce.acceptedExtensions).toEqual([".pce", ".sgx"]);
  });

  it("detects GameCube and Wii discs by header signature", () => {
    const gc = Buffer.alloc(0x40);
    gc.writeUInt32BE(0xc2339f3d, 0x1c);
    expect(CONSOLES.gc.detect(gc)).toBe(true);
    expect(CONSOLES.wii.detect(gc)).toBe(false);

    const wii = Buffer.alloc(0x40);
    wii.writeUInt32BE(0x5d1c9ea3, 0x18);
    expect(CONSOLES.wii.detect(wii)).toBe(true);
    expect(CONSOLES.gc.detect(wii)).toBe(false);

    expect(SIGNATURES).toEqual([
      { id: "gc", offset: 0x1c, bytes: [0xc2, 0x33, 0x9f, 0x3d] },
      { id: "wii", offset: 0x18, bytes: [0x5d, 0x1c, 0x9e, 0xa3] },
    ]);
  });

  it("detects iNES and N64 ROMs by magic", () => {
    expect(CONSOLES.nes.detect(Buffer.from([0x4e, 0x45, 0x53, 0x1a, 0x00]))).toBe(true);
    expect(CONSOLES.nes.detect(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]))).toBe(false);

    const n64 = Buffer.alloc(8);
    n64.writeUInt32BE(0x80371240, 0);
    expect(CONSOLES.n64.detect(n64)).toBe(true);
  });

  it("returns false rather than throwing on short buffers", () => {
    const tiny = Buffer.alloc(2);
    for (const id of CONSOLE_IDS) {
      expect(CONSOLES[id].detect(tiny)).toBe(false);
    }
  });
});

describe("main-process ENGINES is built from the catalog", () => {
  it("takes its display name and console list from the catalog", () => {
    for (const engineId of ENGINE_IDS) {
      expect(ENGINES[engineId].name).toBe(ENGINE_CATALOG[engineId].displayName);
      expect(ENGINES[engineId].consoles).toEqual(getConsoleIdsForEngine(engineId));
    }
  });

  it("keeps Mesen's multi-console list in catalog order", () => {
    expect(ENGINES.mesen.consoles).toEqual([
      "nes", "snes", "gb", "gba", "gg", "sms", "pce",
    ]);
    expect(ENGINES.dolphin.consoles).toEqual(["gc", "wii"]);
  });
});
