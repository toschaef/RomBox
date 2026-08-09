// what rombox owns vs what it only references. deleting a game consults this,
// so a false positive deletes a file the user brought with them.
import fs from "fs";
import path from "path";
import { isManagedPath, isMissing, romsRoot } from "../../../../src/main/services/library/gamePaths";
import { suiteTempDir, suiteUserDataDir } from "../../../helpers/tempDirs";

describe("romsRoot", () => {
  it("sits under userData", () => {
    expect(romsRoot()).toBe(path.join(suiteUserDataDir(), "roms"));
  });
});

describe("isManagedPath", () => {
  it("owns files rombox extracted into its roms directory", () => {
    expect(isManagedPath(path.join(romsRoot(), "nes", "smb.nes"))).toBe(true);
  });

  it("does not own a file the user keeps elsewhere", () => {
    expect(isManagedPath("/Users/someone/Games/smb.nes")).toBe(false);
  });

  it("does not own the roms directory itself", () => {
    expect(isManagedPath(romsRoot())).toBe(false);
  });

  it("is not fooled by a sibling directory with the same prefix", () => {
    expect(isManagedPath(`${romsRoot()}-backup/smb.nes`)).toBe(false);
  });

  it("does not own a path that escapes the roms directory", () => {
    expect(isManagedPath(path.join(romsRoot(), "..", "..", "smb.nes"))).toBe(false);
  });

  it("treats an empty path as unowned", () => {
    expect(isManagedPath("")).toBe(false);
  });
});

describe("isMissing", () => {
  it("reports a file that is there", () => {
    const file = path.join(suiteTempDir(), "present.nes");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "rom");
    expect(isMissing(file)).toBe(false);
  });

  it("reports a file that is gone", () => {
    expect(isMissing(path.join(suiteTempDir(), "absent.nes"))).toBe(true);
  });

  it("treats an empty path as missing", () => {
    expect(isMissing("")).toBe(true);
  });
});
