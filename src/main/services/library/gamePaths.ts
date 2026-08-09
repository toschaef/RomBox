import fs from "fs";
import path from "path";
import { app } from "electron";


export function romsRoot(): string {
  return path.join(app.getPath("userData"), "roms");
}

function normalize(p: string): string {
  const resolved = path.resolve(p);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isManagedPath(filePath: string): boolean {
  if (!filePath) return false;
  const root = normalize(romsRoot());
  const target = normalize(filePath);
  return target !== root && target.startsWith(root + path.sep);
}

export function isMissing(filePath: string): boolean {
  if (!filePath) return true;
  try {
    return !fs.existsSync(filePath);
  } catch {
    return true;
  }
}
