/* eslint-disable @typescript-eslint/no-var-requires */
import path from "path";
import fs from "fs";
import { initDB } from "../../src/main/data/db";
import { EngineService } from "../../src/main/services/EngineService";
import { ENGINES } from "../../src/main/config/engines";
import type { Platform } from "../../src/shared/types";
import type { EngineID } from "../../src/shared/types/engines";

// Mock 'os' to redirect homedir to our temp userdata folder
jest.mock("os", () => {
  const path = require("path");
  return {
    ...jest.requireActual("os"),
    homedir: () => path.resolve(__dirname, "../temp-userdata"),
  };
});

// Mock downloader to prevent network requests and create dummy downloaded archive files (>= 1MB)
jest.mock("../../src/main/utils/downloader", () => ({
  Downloader: {
    download: jest.fn().mockImplementation(async (url: string, destDir: string) => {
      const fs = require("fs");
      const path = require("path");
      fs.mkdirSync(destDir, { recursive: true });
      const tempFile = path.join(destDir, `mock-download-${Date.now()}-${Math.random()}.zip`);
      // Write 1MB of dummy data so it passes stats.size >= 1MB check in installEngine
      fs.writeFileSync(tempFile, Buffer.alloc(1024 * 1024));
      return tempFile;
    }),
  },
}));

// Mock osHandler to simulate platform-specific extractions and finalizations
jest.mock("../../src/main/platform", () => {
  const path = require("path");
  const fs = require("fs");
  const { ENGINES } = require("../../src/main/config/engines");
  const tempDir = path.resolve(__dirname, "../temp-userdata");

  return {
    osHandler: {
      extractArchive: jest.fn().mockImplementation(async (archivePath: string, destDir: string) => {
        const engineId = path.basename(destDir);
        const platform = process.platform;
        const cfg = ENGINES[engineId];
        if (cfg) {
          const binaryConfigPath = cfg.binaries[platform];
          if (binaryConfigPath) {
            const binaryAbsPath = path.join(destDir, binaryConfigPath);
            fs.mkdirSync(path.dirname(binaryAbsPath), { recursive: true });
            fs.writeFileSync(binaryAbsPath, "mock-binary-executable");
          }
        }
      }),
      installDependency: jest.fn().mockResolvedValue(true),
      finalizeInstall: jest.fn().mockResolvedValue(true),
      getEmulatorConfigPath: jest.fn().mockImplementation((engineId: string) => {
        return path.join(tempDir, "mock-configs", engineId);
      }),
      getEmulatorBasePath: jest.fn().mockImplementation((engineId: string) => {
        return path.join(tempDir, "engines", engineId);
      }),
      clearPlatformData: jest.fn(),
    },
  };
});

// Mock BiosService to prevent actual bios cache lookup/installation
jest.mock("../../src/main/services/BiosService", () => ({
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

describe("Emulator Installation and Binary Path Integration Tests", () => {
  const tempDir = path.resolve(__dirname, "../temp-userdata");

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    initDB();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Target platforms to test. Currently only 'darwin' is supported by RomBox.
  // This array can be extended with 'win32' and 'linux' in the future.
  const targetPlatforms: Platform[] = ["darwin"];
  const engineIds = Object.keys(ENGINES) as EngineID[];

  for (const engineId of engineIds) {
    const cfg = ENGINES[engineId];
    
    // Find target platforms that are supported by the engine config
    const supportedTargetPlatforms = targetPlatforms.filter(
      (platform) => cfg.downloads[platform] && cfg.binaries[platform]
    );

    if (supportedTargetPlatforms.length === 0) {
      continue;
    }

    describe(`Engine: ${cfg.name} (${engineId})`, () => {
      for (const platform of supportedTargetPlatforms) {
        it(`should install successfully and verify executable is in the right place on ${platform}`, async () => {
          const originalPlatform = process.platform;
          if (originalPlatform !== platform) {
            Object.defineProperty(process, "platform", {
              value: platform,
              configurable: true,
            });
          }

          try {
            // Verify getEnginePath initially returns null because it's not installed
            const initialPath = await EngineService.getEnginePath(engineId);
            expect(initialPath).toBeNull();

            const progressCallback = jest.fn();

            // Install the engine
            const result = await EngineService.installEngine(engineId, progressCallback);
            expect(result).toBeDefined();
            expect(result?.success).toBe(true);

            // Verify that getEnginePath resolves to the correct binary location
            const resolvedPath = await EngineService.getEnginePath(engineId);
            expect(resolvedPath).not.toBeNull();

            // Verify the executable file actually exists on disk
            expect(fs.existsSync(resolvedPath as string)).toBe(true);

            // Verify that the resolved path contains the expected binary configuration path structure
            const expectedBinaryConfigPath = cfg.binaries[platform];
            expect(resolvedPath).toContain(expectedBinaryConfigPath);
          } finally {
            if (originalPlatform !== platform) {
              Object.defineProperty(process, "platform", {
                value: originalPlatform,
                configurable: true,
              });
            }
          }
        });
      }
    });
  }
});
