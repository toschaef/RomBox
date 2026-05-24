import fs from "fs";
import path from "path";
import { EngineService } from "../../../src/main/services/EngineService";

jest.mock("../../../src/main/platform", () => ({
  osHandler: {
    resolveBinaryPath: jest.fn().mockImplementation((dir: string) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      if (fs.existsSync(dir)) {
        return "/mock/path/to/binary";
      }
      throw new Error("Not installed");
    }),
    extractArchive: jest.fn().mockResolvedValue(true),
    installDependency: jest.fn().mockResolvedValue(true),
    finalizeInstall: jest.fn().mockResolvedValue(true),
    getEmulatorConfigPath: jest.fn().mockReturnValue("/mock/emulator/config"),
    getEmulatorBasePath: jest.fn().mockReturnValue("/mock/emulator/base"),
    clearPlatformData: jest.fn()
  }
}));

jest.mock("../../../src/main/utils/downloader", () => ({
  Downloader: {
    download: jest.fn().mockResolvedValue("/mock/downloaded/file.zip")
  }
}));

jest.mock("../../../src/main/services/BiosService", () => ({
  BiosService: {
    getConsoleBiosStatus: jest.fn().mockReturnValue({
      needsBios: false,
      biosState: "none",
      missingRequiredFiles: [],
      missingWarningFiles: []
    }),
    ensureBiosInstalledFromCache: jest.fn().mockReturnValue({ copied: [], missing: [] })
  }
}));

describe("EngineService", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should get engines list and their statuses", async () => {
    const list = await EngineService.getEngines();
    expect(list.length).toBeGreaterThan(0);
    const mesen = list.find(e => e.engineId === "mesen");
    expect(mesen).toBeDefined();
    expect(mesen?.name).toBe("Mesen 2");
  });

  it("should resolve engine path successfully if installed", async () => {
    // Make install dir exist
    const installDir = path.join(tempDir, "engines", "mesen");
    fs.mkdirSync(installDir, { recursive: true });

    // Mock platform write
    const resolvedPath = await EngineService.getEnginePath("mesen");
    expect(resolvedPath).toBe("/mock/path/to/binary");
  });

  it("should return null for engine path if not installed", async () => {
    const resolvedPath = await EngineService.getEnginePath("mesen");
    expect(resolvedPath).toBeNull();
  });

  it("should install an engine successfully", async () => {
    const progressSpy = jest.fn();
    
    // Setup file size mock
    jest.spyOn(fs, "statSync").mockReturnValue({ size: 10 * 1024 * 1024 } as unknown as fs.Stats); // 10MB
    jest.spyOn(fs, "readdirSync").mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    jest.spyOn(fs, "unlinkSync").mockImplementation(() => { /* mock */ });

    const result = await EngineService.installEngine("mesen", progressSpy);
    expect(result?.success).toBe(true);
    expect(progressSpy).toHaveBeenCalledWith("Downloading");
    expect(progressSpy).toHaveBeenCalledWith("Extracting");
  });

  it("should delete an engine", () => {
    const installDir = path.join(tempDir, "engines", "mesen");
    fs.mkdirSync(installDir, { recursive: true });

    const rmSpy = jest.spyOn(fs, "rmSync").mockImplementation(() => { /* mock */ });

    const result = EngineService.deleteEngine("mesen");
    expect(result.success).toBe(true);
    expect(rmSpy).toHaveBeenCalled();
  });

  it("should clear all engines successfully", () => {
    jest.spyOn(fs, "rmSync").mockImplementation(() => { /* mock */ });
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => "");

    const result = EngineService.clearEngines();
    expect(result.success).toBe(true);
  });
});
