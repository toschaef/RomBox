// Mock 'os' at the very top before any service/config imports are resolved
jest.mock("os", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../../temp-userdata"),
  };
});

import path from "path";

import fs from "fs";
import { BiosService } from "../../../src/main/services/BiosService";
import AdmZip from "adm-zip";

describe("BiosService", () => {
  const tempDir = path.resolve(__dirname, "../../temp-userdata");

  beforeEach(() => {
    // Setup clean environment in tempUserData
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

  it("should get console BIOS status when BIOS is not required", () => {
    const status = BiosService.getConsoleBiosStatus("nes");
    expect(status.needsBios).toBe(false);
    expect(status.biosState).toBe("none");
  });

  it("should get console BIOS status when BIOS is missing", () => {
    // PS1 has BIOS files
    const status = BiosService.getConsoleBiosStatus("ps1");
    expect(status.needsBios).toBe(true);
    expect(status.biosState).toBe("missing");
    expect(status.missingRequiredFiles.length).toBeGreaterThan(0);
  });

  it("should report BIOS as warning if missing optional / game-specific firmware", () => {
    // SNES bios is optional / snes specific
    const status = BiosService.getConsoleBiosStatus("snes");
    expect(status.biosState).toBe("warning"); // optional firmware missing results in warning
  });

  it("should install BIOS from a single file successfully", async () => {
    // Let's create a dummy source BIOS file
    const biosSource = path.join(tempDir, "scph1001.bin");
    fs.writeFileSync(biosSource, "dummy-ps1-bios-data");

    // Install BIOS for PS1
    const result = await BiosService.installBios("ps1", biosSource);
    expect(result.success).toBe(true);
    expect(result.installed).toContain("scph1001.bin");

    // Check status
    const status = BiosService.getConsoleBiosStatus("ps1");
    expect(status.biosState).toBe("ok");
    expect(status.missingRequiredFiles).not.toContain("scph1001.bin");
  });

  it("should respect onlyNeedOne configuration for ps1", async () => {
    // Before installing any, it should be missing and show all files as missing required
    const statusBefore = BiosService.getConsoleBiosStatus("ps1");
    expect(statusBefore.onlyNeedOne).toBe(true);
    expect(statusBefore.biosState).toBe("missing");
    expect(statusBefore.missingRequiredFiles).toContain("scph1001.bin");
    expect(statusBefore.missingRequiredFiles).toContain("scph5500.bin");

    // Let's create a dummy source BIOS file for scph5500.bin (which was warning level in config)
    const biosSource = path.join(tempDir, "scph5500.bin");
    fs.writeFileSync(biosSource, "dummy-ps1-bios-data-japan");

    // Install scph5500.bin
    await BiosService.installBios("ps1", biosSource);
    const statusAfter = BiosService.getConsoleBiosStatus("ps1");
    expect(statusAfter.biosState).toBe("ok");
    expect(statusAfter.missingRequiredFiles.length).toBe(0);
    expect(statusAfter.missingWarningFiles.length).toBe(0);
  });

  it("should fail to install BIOS if filename is invalid", async () => {
    const invalidSource = path.join(tempDir, "invalid.bin");
    fs.writeFileSync(invalidSource, "dummy-data");

    await expect(async () => {
      await BiosService.installBios("ps1", invalidSource);
    }).rejects.toThrow("is not a valid BIOS for ps1");
  });

  it("should install BIOS from a ZIP file successfully", async () => {
    const zipPath = path.join(tempDir, "bios.zip");
    const zip = new AdmZip();
    zip.addFile("scph1001.bin", Buffer.from("dummy-data"));
    zip.writeZip(zipPath);

    const result = await BiosService.installBios("ps1", zipPath);
    expect(result.success).toBe(true);
    expect(result.installed).toContain("scph1001.bin");
  });

  it("should delete BIOS successfully", async () => {
    // Install first
    const biosSource = path.join(tempDir, "scph1001.bin");
    fs.writeFileSync(biosSource, "dummy-ps1-bios-data");
    await BiosService.installBios("ps1", biosSource);

    // Delete
    const deleteResult = await BiosService.deleteBios("ps1", "scph1001.bin");
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.deleted).toBeGreaterThan(0);

    const status = BiosService.getConsoleBiosStatus("ps1");
    expect(status.biosState).toBe("missing");
  });

  it("should restore BIOS from cache if available", async () => {
    // Put bios directly in cache but not in firmware
    const cacheDir = path.join(tempDir, "bios", "ps1");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "scph1001.bin"), "dummy-ps1-bios-data");

    const result = BiosService.ensureBiosInstalledFromCache("ps1");
    expect(result.copied).toContain("scph1001.bin");

    const status = BiosService.getConsoleBiosStatus("ps1");
    expect(status.biosState).toBe("ok");
  });
});
