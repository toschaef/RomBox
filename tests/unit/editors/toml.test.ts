import fs from "fs";
import path from "path";
import { TomlEditor } from "../../../src/main/utils/editors/toml";

describe("TomlEditor", () => {
  const tempDir = path.resolve(__dirname, "../../temp-toml-test");
  const testFile = path.join(tempDir, "test.toml");

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

  describe("updateTomlKV", () => {
    it("should create file and write keys if file does not exist", () => {
      TomlEditor.updateTomlKV(testFile, { key1: "value1", key2: "value2" });
      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("key1 = value1");
      expect(content).toContain("key2 = value2");
    });

    it("should update existing keys while preserving comments", () => {
      fs.writeFileSync(testFile, "key1 = old # keep this\nkey2 = another");
      TomlEditor.updateTomlKV(testFile, { key1: "new" });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("key1 = new # keep this");
      expect(content).toContain("key2 = another");
    });

    it("should add new keys at the end if they are missing", () => {
      fs.writeFileSync(testFile, "key1 = value1");
      TomlEditor.updateTomlKV(testFile, { key1: "updated", key2: "new" });

      const content = fs.readFileSync(testFile, "utf-8");
      const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
      expect(lines).toContain("key1 = updated");
      expect(lines).toContain("key2 = new");
    });
  });

  describe("updateTomlTableKV", () => {
    it("should create a table and insert keys if table is missing", () => {
      fs.writeFileSync(testFile, "key1 = value1");
      TomlEditor.updateTomlTableKV(testFile, "my-table", { key2: "value2", key3: "value3" });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("[my-table]");
      expect(content).toContain("key2 = value2");
      expect(content).toContain("key3 = value3");
    });

    it("should update keys inside a specific table while leaving others untouched", () => {
      const initial = `
[table-a]
key = value1

[table-b]
key = value2
      `.trim();
      fs.writeFileSync(testFile, initial);

      TomlEditor.updateTomlTableKV(testFile, "table-b", { key: "updated" });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("[table-a]\nkey = value1");
      expect(content).toContain("[table-b]\nkey = updated");
    });
  });
});
