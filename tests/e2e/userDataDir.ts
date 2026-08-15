import { execFileSync } from "node:child_process";
import fs from "node:fs";

/**
 * dmg installs mount inside the user data dir. a killed app (or a detach that
 * loses the race with the copy) leaves the volume attached, and every later run
 * then fails with EBUSY when it tries to wipe the dir.
 */
function detachStaleMounts(dir: string): void {
  if (process.platform !== "darwin") return;

  let info = "";
  try {
    info = execFileSync("hdiutil", ["info"], { encoding: "utf8" });
  } catch {
    return;
  }

  for (const line of info.split("\n")) {
    const mountPoint = line.split("\t").pop()?.trim();
    if (!mountPoint?.startsWith(`${dir}/`)) continue;
    try {
      execFileSync("hdiutil", ["detach", mountPoint, "-force"], { stdio: "ignore" });
    } catch {
      // already gone, or busy for a reason rmSync will report
    }
  }
}

export function resetUserDataDir(dir: string): void {
  if (fs.existsSync(dir)) {
    detachStaleMounts(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

export function cleanUserDataDir(dir: string): void {
  if (!fs.existsSync(dir)) return;
  detachStaleMounts(dir);
  fs.rmSync(dir, { recursive: true, force: true });
}
