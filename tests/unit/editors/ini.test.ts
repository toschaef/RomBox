import fs from "fs";
import path from "path";
import { IniEditor } from "../../../src/main/utils/editors/ini";

describe("IniEditor", () => {
  const tempDir = path.resolve(__dirname, "../../temp-ini-test");
  const testFile = path.join(tempDir, "test.ini");

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

  describe("updateIni", () => {
    it("should write root keys and section keys if file is empty", () => {
      IniEditor.updateIni(testFile, {
        "": { rootKey: "rootVal" },
        "SectionA": { secKey: "secVal" }
      });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("rootKey = rootVal");
      expect(content).toContain("[SectionA]");
      expect(content).toContain("secKey = secVal");
    });

    it("should update existing keys while leaving others intact", () => {
      const initial = `
rootKey = oldRoot
[SectionA]
secKey = oldSec
otherKey = keepMe
      `.trim();
      fs.writeFileSync(testFile, initial);

      IniEditor.updateIni(testFile, {
        "": { rootKey: "newRoot" },
        "SectionA": { secKey: "newSec" }
      });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("rootKey = newRoot");
      expect(content).toContain("[SectionA]");
      expect(content).toContain("secKey = newSec");
      expect(content).toContain("otherKey = keepMe");
    });

    it("should support compact format spacing", () => {
      IniEditor.updateIni(testFile, {
        "": { key: "val" }
      }, { format: "compact" });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("key=val");
      expect(content).not.toContain("key = val");
    });
  });

  describe("deleteKeys", () => {
    it("should delete keys from specific sections", () => {
      const initial = `
[SectionA]
key1 = val1
key2 = val2
[SectionB]
key1 = val1
      `.trim();
      fs.writeFileSync(testFile, initial);

      IniEditor.deleteKeys(testFile, {
        "SectionA": ["key1"]
      });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).not.toContain("SectionA]\nkey1 = val1");
      expect(content).toContain("key2 = val2");
      expect(content).toContain("[SectionB]\nkey1 = val1");
    });
  });

  describe("resetSectionKeys", () => {
    it("should proxy to deleteKeys to reset keys", () => {
      const initial = `
[SectionA]
key = val
      `.trim();
      fs.writeFileSync(testFile, initial);

      IniEditor.resetSectionKeys(testFile, "SectionA", ["key"]);

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).not.toContain("key = val");
    });
  });

  describe("overwriteSection", () => {
    it("should overwrite all keys in a section with sorted parameters", () => {
      const initial = `
[SectionA]
zKey = 1
aKey = 2
      `.trim();
      fs.writeFileSync(testFile, initial);

      IniEditor.overwriteSection(testFile, "SectionA", {
        cKey: "3",
        bKey: "4"
      });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("[SectionA]\nbKey = 4\ncKey = 3");
      expect(content).not.toContain("zKey = 1");
      expect(content).not.toContain("aKey = 2");
    });

    it("should create section and append it at the end if section was missing", () => {
      fs.writeFileSync(testFile, "[SectionA]\nkey1 = val1");

      IniEditor.overwriteSection(testFile, "SectionB", {
        key2: "val2"
      });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("[SectionA]");
      expect(content).toContain("[SectionB]\nkey2 = val2");
    });
  });
});
