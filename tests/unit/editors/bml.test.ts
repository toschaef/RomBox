import fs from "fs";
import path from "path";
import { BmlEditor } from "../../../src/main/utils/editors/bml";

describe("BmlEditor", () => {
  const tempDir = path.resolve(__dirname, "../../temp-bml-test");
  const testFile = path.join(tempDir, "test.bml");

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

  describe("updateBml", () => {
    it("should throw error if blockPath has length !== 1", () => {
      expect(() => {
        BmlEditor.updateBml(testFile, ["sub", "nested"], { key: "val" });
      }).toThrow("BmlEditor.updateBml only supports top-level sections");
    });

    it("should create section and write keys if section is missing", () => {
      BmlEditor.updateBml(testFile, ["Video"], { width: "1920", height: "1080" });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("Video");
      expect(content).toContain("  width: 1920");
      expect(content).toContain("  height: 1080");
    });

    it("should update existing keys inside a section and preserve hierarchy indents", () => {
      const initial = `
Video
  width: 800
  height: 600

Audio
  volume: 50
      `.trim();
      fs.writeFileSync(testFile, initial);

      BmlEditor.updateBml(testFile, ["Video"], { width: "1280" });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("Video\n  width: 1280\n  height: 600");
      expect(content).toContain("Audio\n  volume: 50");
    });

    it("should deduplicate existing identical keys while leaving the first one and updating it", () => {
      const initial = `
Video
  width: 800
  width: 1024
      `.trim();
      fs.writeFileSync(testFile, initial);

      BmlEditor.updateBml(testFile, ["Video"], { width: "1280" });

      const content = fs.readFileSync(testFile, "utf-8");
      const lines = content.split("\n").map(l => l.trim());
      const widthLines = lines.filter(l => l.startsWith("width:"));
      expect(widthLines).toHaveLength(1);
      expect(widthLines[0]).toBe("width: 1280");
    });
  });
});
