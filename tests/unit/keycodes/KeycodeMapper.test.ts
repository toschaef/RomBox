import { KeycodeMapper, keycodeMapper } from "../../../src/main/utils/keycodes/KeycodeMapper";

describe("KeycodeMapper", () => {
  describe("Mesen 2", () => {
    it("should map DOM key codes to macOS Quartz keycodes on darwin", () => {
      // KeyU -> 64 in Mesen MacOSKeyManager
      expect(KeycodeMapper.toKeycode("mesen", "KeyU", "darwin")).toBe(64);
      // KeyT -> 63
      expect(KeycodeMapper.toKeycode("mesen", "KeyT", "darwin")).toBe(63);
      // KeyW -> 66
      expect(KeycodeMapper.toKeycode("mesen", "KeyW", "darwin")).toBe(66);
      // Digit3 -> 37
      expect(KeycodeMapper.toKeycode("mesen", "Digit3", "darwin")).toBe(37);
    });

    it("should map DOM key codes to Windows VK codes on win32", () => {
      // KeyA -> 65 (VK_A)
      expect(KeycodeMapper.toKeycode("mesen", "KeyA", "win32")).toBe(65);
      // KeyW -> 87 (VK_W)
      expect(KeycodeMapper.toKeycode("mesen", "KeyW", "win32")).toBe(87);
      // Space -> 32
      expect(KeycodeMapper.toKeycode("mesen", "Space", "win32")).toBe(32);
      // ArrowUp -> 38
      expect(KeycodeMapper.toKeycode("mesen", "ArrowUp", "win32")).toBe(38);
      // ShiftLeft -> 160
      expect(KeycodeMapper.toKeycode("mesen", "ShiftLeft", "win32")).toBe(160);
    });
  });

  describe("Ares", () => {
    it("should map DOM key codes to macOS Quartz key index on darwin", () => {
      // Digit3 -> Num3 -> Index 24
      expect(KeycodeMapper.toKeycode("ares", "Digit3", "darwin")).toBe(24);
      // KeyT -> T -> Index 59
      expect(KeycodeMapper.toKeycode("ares", "KeyT", "darwin")).toBe(59);
      // KeyU -> U -> Index 60
      expect(KeycodeMapper.toKeycode("ares", "KeyU", "darwin")).toBe(60);
      // KeyW -> W -> Index 62
      expect(KeycodeMapper.toKeycode("ares", "KeyW", "darwin")).toBe(62);
    });

    it("should map DOM key codes to Windows VK code/index on win32", () => {
      // KeyA -> 65
      expect(KeycodeMapper.toKeycode("ares", "KeyA", "win32")).toBe(65);
      // KeyW -> 87
      expect(KeycodeMapper.toKeycode("ares", "KeyW", "win32")).toBe(87);
      // ArrowUp -> 38
      expect(KeycodeMapper.toKeycode("ares", "ArrowUp", "win32")).toBe(38);
    });
  });

  describe("Dolphin", () => {
    it("should map DOM key codes to Dolphin macOS key strings on darwin", () => {
      expect(KeycodeMapper.toKeycode("dolphin", "KeyU", "darwin")).toBe("U");
      expect(KeycodeMapper.toKeycode("dolphin", "ArrowUp", "darwin")).toBe("Up Arrow");
      expect(KeycodeMapper.toKeycode("dolphin", "Space", "darwin")).toBe("Space");
    });

    it("should map DOM key codes to Dolphin Windows key strings on win32", () => {
      expect(KeycodeMapper.toKeycode("dolphin", "KeyU", "win32")).toBe("U");
      expect(KeycodeMapper.toKeycode("dolphin", "ArrowUp", "win32")).toBe("UP");
      expect(KeycodeMapper.toKeycode("dolphin", "Space", "win32")).toBe("SPACE");
      expect(KeycodeMapper.toKeycode("dolphin", "ShiftLeft", "win32")).toBe("LSHIFT");
    });
  });

  describe("DuckStation", () => {
    it("should map DOM key codes to DuckStation key strings on both darwin and win32", () => {
      expect(KeycodeMapper.toKeycode("duckstation", "KeyU", "darwin")).toBe("U");
      expect(KeycodeMapper.toKeycode("duckstation", "ArrowUp", "win32")).toBe("Up");
      expect(KeycodeMapper.toKeycode("duckstation", "ShiftLeft", "darwin")).toBe("LeftShift");
    });
  });

  describe("Instance & alias methods", () => {
    it("should work using instance methods and aliases", () => {
      expect(keycodeMapper.toKeycode("mesen", "KeyA", "win32")).toBe(65);
      expect(KeycodeMapper.resolve("mesen", "KeyA", "win32")).toBe(65);
      expect(keycodeMapper.resolve("mesen", "KeyA", "win32")).toBe(65);
    });

    it("should return null for unknown engines or invalid key codes", () => {
      expect(KeycodeMapper.toKeycode("unknownEngine", "KeyA", "darwin")).toBeNull();
      expect(KeycodeMapper.toKeycode("mesen", "NonExistentKey", "darwin")).toBeNull();
    });

    it("should prevent prototype property leakage by returning null for prototype keys", () => {
      const protoKeys = ["toString", "hasOwnProperty", "valueOf", "__proto__", "constructor"];
      const engines = ["mesen", "ares", "dolphin", "duckstation"] as const;
      const platforms = ["darwin", "win32"] as const;

      for (const engine of engines) {
        for (const platform of platforms) {
          for (const key of protoKeys) {
            expect(KeycodeMapper.toKeycode(engine, key, platform)).toBeNull();
          }
        }
      }
    });

    it("should map punctuation, F1-F12, and Numpad keys across engines", () => {
      // Mesen darwin & win32 punctuation & F1-F12 & Numpad
      expect(typeof KeycodeMapper.toKeycode("mesen", "Comma", "darwin")).toBe("number");
      expect(typeof KeycodeMapper.toKeycode("mesen", "Semicolon", "win32")).toBe("number");
      expect(KeycodeMapper.toKeycode("mesen", "F1", "win32")).toBe(112);
      expect(KeycodeMapper.toKeycode("mesen", "Numpad0", "win32")).toBe(96);

      // Ares win32 punctuation & F1-F12 & Numpad
      expect(KeycodeMapper.toKeycode("ares", "Comma", "win32")).toBe(188);
      expect(KeycodeMapper.toKeycode("ares", "F1", "win32")).toBe(112);
      expect(KeycodeMapper.toKeycode("ares", "Numpad5", "win32")).toBe(101);

      // Dolphin win32 & darwin
      expect(KeycodeMapper.toKeycode("dolphin", "Comma", "win32")).toBe("COMMA");
      expect(KeycodeMapper.toKeycode("dolphin", "F1", "win32")).toBe("F1");
      expect(KeycodeMapper.toKeycode("dolphin", "Numpad0", "win32")).toBe("NUMPAD0");

      // DuckStation
      expect(KeycodeMapper.toKeycode("duckstation", "Comma", "darwin")).toBe(",");
      expect(KeycodeMapper.toKeycode("duckstation", "F1", "darwin")).toBe("F1");
      expect(KeycodeMapper.toKeycode("duckstation", "Numpad0", "darwin")).toBe("Numpad0");
    });
  });
});
