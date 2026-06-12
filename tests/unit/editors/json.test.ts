import fs from "fs";
import path from "path";
import { JsonEditor } from "../../../src/main/utils/editors/json";

describe("JsonEditor", () => {
  const tempDir = path.resolve(__dirname, "../../temp-json-test");
  const testFile = path.join(tempDir, "test.json");

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("safeParse", () => {
    it("should return parsed object for valid JSON", () => {
      const res = JsonEditor.safeParse('{"ok": true}');
      expect(res).toEqual({ ok: true });
    });

    it("should return null for invalid JSON", () => {
      const res = JsonEditor.safeParse("{invalid}");
      expect(res).toBeNull();
    });
  });

  describe("stringify", () => {
    it("should format string with spacing", () => {
      const res = JsonEditor.stringify({ a: 1 }, 2, false);
      expect(res).toBe('{\n  "a": 1\n}');
    });

    it("should append a trailing newline if instructed", () => {
      const res = JsonEditor.stringify({ a: 1 }, 2, true);
      expect(res).toBe('{\n  "a": 1\n}\n');
    });
  });

  describe("exists", () => {
    it("should return true if file exists", () => {
      fs.writeFileSync(testFile, "{}");
      expect(JsonEditor.exists(testFile)).toBe(true);
    });

    it("should return false if file does not exist", () => {
      expect(JsonEditor.exists(testFile)).toBe(false);
    });
  });

  describe("read", () => {
    it("should read and parse valid JSON from file", () => {
      fs.writeFileSync(testFile, '{"val": 42}');
      const res = JsonEditor.read<{ val: number }>(testFile);
      expect(res.val).toBe(42);
    });

    it("should strip UTF-8 BOM if present", () => {
      fs.writeFileSync(testFile, "\ufeff" + '{"val": 42}', "utf-8");
      const res = JsonEditor.read<{ val: number }>(testFile);
      expect(res.val).toBe(42);
    });

    it("should throw error if file is missing and createIfMissing is false", () => {
      expect(() => JsonEditor.read(testFile)).toThrow("JSON file not found");
    });

    it("should return fallback and not throw if createIfMissing is true", () => {
      const res = JsonEditor.read(testFile, { fallback: true }, { createIfMissing: true });
      expect(res).toEqual({ fallback: true });
    });

    it("should throw error if file is invalid JSON", () => {
      fs.writeFileSync(testFile, "{invalid}");
      expect(() => JsonEditor.read(testFile)).toThrow("Invalid JSON");
    });
  });

  describe("tryRead", () => {
    it("should return parsed value if valid", () => {
      fs.writeFileSync(testFile, '{"ok": true}');
      const res = JsonEditor.tryRead(testFile, { ok: false });
      expect(res.ok).toBe(true);
    });

    it("should strip UTF-8 BOM if present", () => {
      fs.writeFileSync(testFile, "\ufeff" + '{"ok": true}', "utf-8");
      const res = JsonEditor.tryRead(testFile, { ok: false });
      expect(res.ok).toBe(true);
    });

    it("should return fallback if file does not exist or has invalid JSON", () => {
      const res1 = JsonEditor.tryRead(testFile, { ok: "fallback" });
      expect(res1).toEqual({ ok: "fallback" });

      fs.writeFileSync(testFile, "{bad}");
      const res2 = JsonEditor.tryRead(testFile, { ok: "fallback" });
      expect(res2).toEqual({ ok: "fallback" });
    });
  });

  describe("write", () => {
    it("should atomically write value to JSON file", () => {
      JsonEditor.write(testFile, { hello: "world" }, { prettySpaces: 4, trailingNewline: true });
      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toBe('{\n    "hello": "world"\n}\n');
    });
  });

  describe("update", () => {
    it("should read, apply modification function, and write updated value", () => {
      fs.writeFileSync(testFile, '{"count": 5}');
      const next = JsonEditor.update<{ count: number }>(testFile, (curr) => {
        return { count: curr.count + 1 };
      });

      expect(next.count).toBe(6);
      const parsed = JSON.parse(fs.readFileSync(testFile, "utf-8"));
      expect(parsed.count).toBe(6);
    });
  });

  describe("updateStrict", () => {
    it("should return missing if file does not exist", () => {
      const res = JsonEditor.updateStrict(testFile, (x) => x);
      expect(res).toEqual({ ok: false, reason: "missing" });
    });

    it("should return empty if file is empty string", () => {
      fs.writeFileSync(testFile, "   ");
      const res = JsonEditor.updateStrict(testFile, (x) => x);
      expect(res).toEqual({ ok: false, reason: "empty" });
    });

    it("should return invalid if file is corrupted", () => {
      fs.writeFileSync(testFile, "{corrupt");
      const res = JsonEditor.updateStrict(testFile, (x) => x);
      expect(res).toEqual({ ok: false, reason: "invalid" });
    });

    it("should successfully modify and write if valid", () => {
      fs.writeFileSync(testFile, '{"status": "old"}');
      const res = JsonEditor.updateStrict<{ status: string }>(testFile, () => {
        return { status: "new" };
      });

      expect(res).toEqual({ ok: true, value: { status: "new" } });
      expect(JSON.parse(fs.readFileSync(testFile, "utf-8"))).toEqual({ status: "new" });
    });
  });
});
