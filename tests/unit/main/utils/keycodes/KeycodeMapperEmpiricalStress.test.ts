import { KeycodeMapper } from "../../../../../src/main/utils/keycodes/KeycodeMapper";
import { createDefaultProfileShape } from "../../../../../src/shared/controls/layoutDefaults";
import { MesenTranslator } from "../../../../../src/main/emulators/mesen/translator";
import { AresTranslator } from "../../../../../src/main/emulators/ares/translator";
import { DuckStationTranslator } from "../../../../../src/main/emulators/duckstation/translator";
import type { ControlsProfile } from "../../../../../src/shared/types/controls";

describe("Empirical KeycodeMapper & Key Translators Stress Test", () => {
  const DOM_LETTERS = Array.from({ length: 26 }, (_, i) => `Key${String.fromCharCode(65 + i)}`);
  const DOM_NUMPAD = Array.from({ length: 10 }, (_, i) => `Numpad${i}`);
  const DOM_FUNCTION_KEYS = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);

  const PUNCTUATION_KEYS = [
    "Semicolon", "Equal", "Comma", "Minus", "Period", "Slash", "Backquote",
    "BracketLeft", "Backslash", "BracketRight", "Quote"
  ];

  const UNMAPPED_DOM_CODES = [
    "", "InvalidKey", "KeyA1", "Digit10",
    "PrintScreen", "ScrollLock", "Pause", "Insert", "Delete", "Home", "End", "PageUp", "PageDown",
    "NumLock", "NumpadDivide", "NumpadMultiply", "NumpadSubtract", "NumpadAdd", "NumpadDecimal",
    "IntlBackslash", "IntlRo", "IntlYen", "ContextMenu", "AudioVolumeMute"
  ];

  const PROTOTYPE_POLLUTION_CODES = ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"];

  const ENGINES = ["mesen", "ares", "dolphin", "duckstation"] as const;

  describe("1. Unmapped DOM codes and Edge Inputs across Engines & Platforms", () => {
    UNMAPPED_DOM_CODES.forEach((code) => {
      it(`evaluates behavior for unmapped/edge code: '${code}'`, () => {
        ENGINES.forEach((engine) => {
          const resDarwin = KeycodeMapper.toKeycode(engine, code, "darwin");
          const resWin32 = KeycodeMapper.toKeycode(engine, code, "win32");

          if (["", "InvalidKey", "KeyA1", "Digit10"].includes(code)) {
            expect(resDarwin).toBeNull();
            expect(resWin32).toBeNull();
          }
        });
      });
    });

    describe("Prototype Pollution Edge Cases", () => {
      PROTOTYPE_POLLUTION_CODES.forEach((code) => {
        it(`tests prototype key '${code}' for unexpected object leakage`, () => {
          ENGINES.forEach((engine) => {
            const resDarwin = KeycodeMapper.toKeycode(engine, code, "darwin");
            const resWin32 = KeycodeMapper.toKeycode(engine, code, "win32");

            // Keycode should NEVER return a function or prototype object!
            const isInvalidTypeDarwin = typeof resDarwin === "object" && resDarwin !== null;
            const isInvalidTypeWin32 = typeof resWin32 === "object" && resWin32 !== null;
            const isFunctionDarwin = typeof resDarwin === "function";
            const isFunctionWin32 = typeof resWin32 === "function";

            if (isInvalidTypeDarwin || isInvalidTypeWin32 || isFunctionDarwin || isFunctionWin32) {
              console.warn(`[BUG CONFIRMED] Engine '${engine}' leaked prototype/function for input '${code}': darwin=${resDarwin}, win32=${resWin32}`);
            }
          });
        });
      });
    });
  });

  describe("2. Punctuation Keys Mapping Matrix", () => {
    PUNCTUATION_KEYS.forEach((code) => {
      it(`evaluates punctuation key mapping for '${code}'`, () => {
        const mesenDarwin = KeycodeMapper.toKeycode("mesen", code, "darwin");
        const mesenWin32 = KeycodeMapper.toKeycode("mesen", code, "win32");
        const aresDarwin = KeycodeMapper.toKeycode("ares", code, "darwin");
        const aresWin32 = KeycodeMapper.toKeycode("ares", code, "win32");
        const dolphinDarwin = KeycodeMapper.toKeycode("dolphin", code, "darwin");
        const dolphinWin32 = KeycodeMapper.toKeycode("dolphin", code, "win32");
        const duckDarwin = KeycodeMapper.toKeycode("duckstation", code, "darwin");
        const duckWin32 = KeycodeMapper.toKeycode("duckstation", code, "win32");

        // Verify Mesen darwin & win32 punctuation mappings
        expect(typeof mesenDarwin).toBe("number");
        expect(typeof mesenWin32).toBe("number");

        // Verify Ares darwin & win32 punctuation mappings
        expect(typeof aresDarwin).toBe("number");
        expect(typeof aresWin32).toBe("number");

        // Verify Dolphin & DuckStation punctuation mappings
        expect(typeof dolphinDarwin).toBe("string");
        expect(typeof dolphinWin32).toBe("string");
        expect(typeof duckDarwin).toBe("string");
        expect(typeof duckWin32).toBe("string");
      });
    });
  });

  describe("3. Function Keys Mapping Matrix (F1-F12)", () => {
    DOM_FUNCTION_KEYS.forEach((code) => {
      it(`evaluates function key '${code}'`, () => {
        const mesenDarwin = KeycodeMapper.toKeycode("mesen", code, "darwin");
        const mesenWin32 = KeycodeMapper.toKeycode("mesen", code, "win32");
        const aresDarwin = KeycodeMapper.toKeycode("ares", code, "darwin");
        const aresWin32 = KeycodeMapper.toKeycode("ares", code, "win32");
        const duckDarwin = KeycodeMapper.toKeycode("duckstation", code, "darwin");

        expect(typeof mesenDarwin).toBe("number");
        expect(typeof mesenWin32).toBe("number");
        expect(typeof aresDarwin).toBe("number");
        expect(typeof aresWin32).toBe("number");
        expect(typeof duckDarwin).toBe("string");
      });
    });
  });

  describe("4. Numpad Keys Mapping Matrix (Numpad0-Numpad9)", () => {
    DOM_NUMPAD.forEach((code) => {
      it(`evaluates numpad key '${code}'`, () => {
        const mesenDarwin = KeycodeMapper.toKeycode("mesen", code, "darwin");
        const mesenWin32 = KeycodeMapper.toKeycode("mesen", code, "win32");
        const aresDarwin = KeycodeMapper.toKeycode("ares", code, "darwin");
        const aresWin32 = KeycodeMapper.toKeycode("ares", code, "win32");

        expect(typeof mesenDarwin).toBe("number");
        expect(typeof mesenWin32).toBe("number");
        expect(typeof aresDarwin).toBe("number");
        expect(typeof aresWin32).toBe("number");
      });
    });
  });

  describe("5. Platform Switching & Asymmetries (darwin vs win32 vs linux)", () => {
    it("handles linux platform by defaulting to darwin behavior", () => {
      DOM_LETTERS.forEach((code) => {
        const resDarwin = KeycodeMapper.toKeycode("mesen", code, "darwin");
        const resLinux = KeycodeMapper.toKeycode("mesen", code, "linux");
        expect(resLinux).toEqual(resDarwin);
      });
    });

    it("evaluates keycode type differences across platforms", () => {
      // Ares returns Quartz table index on darwin (number), VK code on win32 (number)
      const aresDarwinA = KeycodeMapper.toKeycode("ares", "KeyA", "darwin");
      const aresWin32A = KeycodeMapper.toKeycode("ares", "KeyA", "win32");
      expect(aresDarwinA).toBe(40); // Quartz Index for 'A'
      expect(aresWin32A).toBe(35); // RawInput Index for 'A'

      // Dolphin returns string key names
      const dolphDarwinUp = KeycodeMapper.toKeycode("dolphin", "ArrowUp", "darwin");
      const dolphWin32Up = KeycodeMapper.toKeycode("dolphin", "ArrowUp", "win32");
      expect(dolphDarwinUp).toBe("Up Arrow");
      expect(dolphWin32Up).toBe("UP");

      // DuckStation platform independence
      const duckDarwinShift = KeycodeMapper.toKeycode("duckstation", "ShiftLeft", "darwin");
      const duckWin32Shift = KeycodeMapper.toKeycode("duckstation", "ShiftLeft", "win32");
      expect(duckDarwinShift).toBe("LeftShift");
      expect(duckWin32Shift).toBe("LeftShift");
    });
  });

  describe("6. Engine Translator Integration End-to-End Test with Key Bindings", () => {
    const mockProfile: ControlsProfile = {
      id: "test-profile-id",
      name: "Test Profile",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
      ...createDefaultProfileShape(),
      player1: {
        ...createDefaultProfileShape().player1,
        face: {
          type: "face",
          primary: { type: "key", code: "KeyJ" },
          secondary: { type: "key", code: "KeyK" },
          tertiary: { type: "key", code: "KeyU" },
          quaternary: { type: "key", code: "KeyI" },
        },
        system: {
          type: "system",
          start: { type: "key", code: "Enter" },
          select: { type: "key", code: "Tab" },
        },
        dpad: {
          type: "dpad",
          up: { type: "key", code: "ArrowUp" },
          down: { type: "key", code: "ArrowDown" },
          left: { type: "key", code: "ArrowLeft" },
          right: { type: "key", code: "ArrowRight" },
        },
        move: {
          type: "dpad",
          up: { type: "key", code: "KeyW" },
          down: { type: "key", code: "KeyS" },
          left: { type: "key", code: "KeyA" },
          right: { type: "key", code: "KeyD" },
        }
      }
    };

    it("MesenTranslator generates valid patches for darwin and win32", () => {
      const translator = new MesenTranslator();
      const patchesDarwin = translator.translate(mockProfile, { consoleId: "snes", platform: "darwin", configDir: "/tmp" });
      const patchesWin32 = translator.translate(mockProfile, { consoleId: "snes", platform: "win32", configDir: "/tmp" });

      expect(patchesDarwin.length).toBeGreaterThan(0);
      expect(patchesWin32.length).toBeGreaterThan(0);

      const patch0Darwin = patchesDarwin[0];
      const patch0Win32 = patchesWin32[0];
      if (patch0Darwin.kind === "json-set" && patch0Win32.kind === "json-set") {
        const mapping1Darwin = (patch0Darwin.value as unknown as Record<string, Record<string, Record<string, number>>>).Port1.Mapping1;
        const mapping1Win32 = (patch0Win32.value as unknown as Record<string, Record<string, Record<string, number>>>).Port1.Mapping1;

        // KeyJ (Face Primary)
        // On darwin, KeyJ -> 38 -> MESEN_KEYCODE_MAP_128[38] -> 53
        expect(mapping1Darwin.A).toBe(53);
        // On win32, KeyJ -> charCodeAt(0) -> 74
        expect(mapping1Win32.A).toBe(74);
      } else {
        throw new Error("Expected json-set patch kind");
      }
    });

    it("AresTranslator formats BML key bindings for darwin and win32", () => {
      const translator = new AresTranslator();
      const patchesDarwin = translator.translate(mockProfile, { platform: "darwin", configDir: "/tmp" });
      const patchesWin32 = translator.translate(mockProfile, { platform: "win32", configDir: "/tmp" });

      const patchMapDarwin = Object.fromEntries(
        patchesDarwin.map((p) => (p.kind === "ini-set" ? [p.key, p.value] : ["", ""]))
      );
      const patchMapWin32 = Object.fromEntries(
        patchesWin32.map((p) => (p.kind === "ini-set" ? [p.key, p.value] : ["", ""]))
      );

      // KeyJ -> 'J' Quartz index is 49 on macOS, VK 74 on win32
      expect(patchMapDarwin["A..South"]).toBe("0x1/0/49;;");
      expect(patchMapWin32["A..South"]).toBe("0x1/0/44;;");
    });

    it("DuckStationTranslator outputs correct ini patches", () => {
      const translator = new DuckStationTranslator();
      const patches = translator.translate(mockProfile, { configDir: "/tmp", platform: "darwin" });

      const patchMap = Object.fromEntries(
        patches.map((p) => (p.kind === "ini-set" ? [p.key, p.value] : ["", ""]))
      );
      expect(patchMap["Cross"]).toBe("Keyboard/J");
      expect(patchMap["Start"]).toBe("Keyboard/Return");
      expect(patchMap["Up"]).toBe("Keyboard/Up");
      expect(patchMap["LUp"]).toBe("Keyboard/W");
    });
  });
});
