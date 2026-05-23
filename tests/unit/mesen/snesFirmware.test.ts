import fs from "fs";
import { getRequiredSnesFirmware } from "../../../src/main/utils/mesen/snesFirmware";
import { inspectSnesRom } from "../../../src/main/utils/mesen/snesInspector";

jest.mock("../../../src/main/utils/mesen/snesInspector", () => ({
  inspectSnesRom: jest.fn()
}));

jest.mock("fs", () => {
  const actualFs = jest.requireActual("fs");
  return {
    ...actualFs,
    statSync: jest.fn()
  };
});

describe("getRequiredSnesFirmware", () => {
  const mockInspectSnesRom = inspectSnesRom as jest.Mock;
  const mockStatSync = fs.statSync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty array if inspectSnesRom returns null", () => {
    mockInspectSnesRom.mockReturnValue(null);
    const result = getRequiredSnesFirmware("/path/to/rom.sfc");
    expect(result).toEqual([]);
  });

  it("should return empty array if ROM type is not in DSP bucket (e.g. low < 3)", () => {
    mockInspectSnesRom.mockReturnValue({
      romType: 0x02, // low = 2, high = 0
      cartName: "SUPER MARIO"
    });

    const result = getRequiredSnesFirmware("/path/to/rom.sfc");
    expect(result).toEqual([]);
  });

  it("should return empty array if ROM already has embedded firmware (special sizes)", () => {
    mockInspectSnesRom.mockReturnValue({
      romType: 0x03, // low = 3, high = 0 (DSP bucket)
      cartName: "PILOTWINGS"
    });

    // Size that triggers embedded firmware checks (e.g. (size & 0x7fff) === 0x2000)
    // 0x2000 is 8192. So 8192 fits (8192 & 32767 = 8192 = 0x2000)
    mockStatSync.mockReturnValue({ size: 0x2000 });

    const result = getRequiredSnesFirmware("/path/to/rom.sfc");
    expect(result).toEqual([]);
  });

  describe("Firmware Cart Mapping", () => {
    beforeEach(() => {
      // Return size that is NOT embedded (e.g. 1MB: 1048576)
      mockStatSync.mockReturnValue({ size: 1048576 });
    });

    it("should resolve Dungeon Master to dsp2.rom", () => {
      mockInspectSnesRom.mockReturnValue({
        romType: 0x03,
        cartName: "DUNGEON MASTER"
      });

      const result = getRequiredSnesFirmware("/path/to/rom.sfc");
      expect(result).toEqual(["dsp2.rom"]);
    });

    it("should resolve Pilotwings to dsp1.rom", () => {
      mockInspectSnesRom.mockReturnValue({
        romType: 0x03,
        cartName: "PILOTWINGS"
      });

      const result = getRequiredSnesFirmware("/path/to/rom.sfc");
      expect(result).toEqual(["dsp1.rom"]);
    });

    it("should resolve Top Gear 3000 to dsp4.rom", () => {
      mockInspectSnesRom.mockReturnValue({
        romType: 0x03,
        cartName: "TOP GEAR 3000"
      });

      const result = getRequiredSnesFirmware("/path/to/rom.sfc");
      expect(result).toEqual(["dsp4.rom"]);
    });

    it("should fallback to dsp1b.rom for other DSP cart titles", () => {
      mockInspectSnesRom.mockReturnValue({
        romType: 0x04,
        cartName: "UNKNOWN DSP GAME"
      });

      const result = getRequiredSnesFirmware("/path/to/rom.sfc");
      expect(result).toEqual(["dsp1b.rom"]);
    });
  });
});
