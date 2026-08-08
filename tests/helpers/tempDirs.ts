// per-suite scratch directories. jest gives each test file its own module
// registry, so this resolves a directory keyed to that file. see docs/testing.md
import path from "path";


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
