import fs from "fs";
import path from "path";
import { inspectSnesRom } from "../../../src/main/utils/mesen/snesInspector";

describe("inspectSnesRom", () => {
  const tempDir = path.resolve(__dirname, "../../temp-snes-test");
  const testFile = path.join(tempDir, "mock-game.sfc");

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

  function createMockRom(headerOffset: number, size: number, title: string, mapMode: number, romType: number) {
    const buf = Buffer.alloc(size);
    
    // Write printable title
    const titleBuf = Buffer.alloc(21, 0x20); // fill with spaces
    titleBuf.write(title, 0, "latin1");
    titleBuf.copy(buf, headerOffset);

    // Map mode and ROM type
    buf[headerOffset + 0x15] = mapMode;
    buf[headerOffset + 0x16] = romType;

    // Checksum & complement (complement ^ checksum should equal 0xffff)
    buf.writeUInt16LE(0x5555, headerOffset + 0x1c);
    buf.writeUInt16LE(0xaaaa, headerOffset + 0x1e);

    // Reset vector (should be >= 0x8000)
    buf.writeUInt16LE(0x9000, headerOffset + 0x3c);

    fs.writeFileSync(testFile, buf);
  }

  it("should inspect LoROM cart headers correctly", () => {
    createMockRom(0x7fc0, 0x10000, "SUPER MARIO WORLD", 0x20, 0x02);

    const result = inspectSnesRom(testFile);
    expect(result).not.toBeNull();
    expect(result!.headerOffset).toBe(0x7fc0);
    expect(result!.cartName.trim()).toBe("SUPER MARIO WORLD");
    expect(result!.mapper).toBe("lorom");
    expect(result!.mapMode).toBe(0x20);
    expect(result!.romType).toBe(0x02);
  });

  it("should inspect HiROM cart headers correctly", () => {
    createMockRom(0xffc0, 0x20000, "CHRONO TRIGGER", 0x21, 0x03);

    const result = inspectSnesRom(testFile);
    expect(result).not.toBeNull();
    expect(result!.headerOffset).toBe(0xffc0);
    expect(result!.cartName.trim()).toBe("CHRONO TRIGGER");
    expect(result!.mapper).toBe("hirom");
    expect(result!.mapMode).toBe(0x21);
    expect(result!.romType).toBe(0x03);
  });

  it("should inspect ExHiROM cart headers correctly", () => {
    // ExHiROM is at 0x40ffc0, file must be at least 4.5MB
    createMockRom(0x40ffc0, 0x410000, "TALES OF PHANTASIA", 0x25, 0x05);

    const result = inspectSnesRom(testFile);
    expect(result).not.toBeNull();
    expect(result!.headerOffset).toBe(0x40ffc0);
    expect(result!.cartName.trim()).toBe("TALES OF PHANTASIA");
    expect(result!.mapper).toBe("exhirom");
    expect(result!.mapMode).toBe(0x25);
    expect(result!.romType).toBe(0x05);
  });

  it("should return null for invalid or corrupted files", () => {
    fs.writeFileSync(testFile, Buffer.from("invalid short rom"));
    const result = inspectSnesRom(testFile);
    expect(result).toBeNull();
  });
});
