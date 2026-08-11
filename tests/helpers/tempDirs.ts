// per-suite scratch directories. jest gives each test file its own module
// registry, so this resolves a directory keyed to that file. see docs/testing.md
import path from "path";
import fs from "fs";


const TESTS_ROOT = path.resolve(__dirname, "..");

function currentSuiteName(): string {
  try {
    const testPath = (expect as unknown as { getState(): { testPath?: string } })
      .getState()
      .testPath;
    if (testPath) {
      return path
        .relative(TESTS_ROOT, testPath)
        .replace(/\.(test|spec)\.[jt]sx?$/, "")
        .replace(/[/\\]/g, "-");
    }
  } catch {
    // not running under Jest
  }
  return `worker-${process.env.JEST_WORKER_ID ?? "1"}`;
}

/** safe to wipe */
export function suiteTempDir(): string {
  return path.join(TESTS_ROOT, ".tmp", currentSuiteName());
}

/** what the electron mock returns for app.getPath("userData") */
export function suiteUserDataDir(): string {
  return path.join(suiteTempDir(), "userdata");
}

/**
 * removes a temp dir plus the artifacts a win32 path fixture leaves behind when
 * the suite runs on posix: path.win32.join turns the posix root into a single
 * relative name full of backslashes, so mkdir drops it in cwd instead.
 */
export function cleanTempDirCrossPlatform(tempDir: string): void {
  const rm = (p: string) => {
    try {
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // directory may be locked briefly; nothing to do
    }
  };

  rm(tempDir);
  if (path.sep === "\\") return;

  const strayPrefix = tempDir.replace(/\//g, "\\");
  for (const entry of fs.readdirSync(process.cwd())) {
    if (entry.startsWith(strayPrefix)) rm(path.join(process.cwd(), entry));
  }
}
