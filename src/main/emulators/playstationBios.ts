import fs from "fs";
import path from "path";

export function findPlayStationBios(
  biosDir: string,
  validBiosNames: string[] = []
): string | null {
  if (!fs.existsSync(biosDir)) return null;

  const isFile = (candidate: string): boolean => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  };

  // prefer a known-good dump, in the caller's order of preference.
  for (const name of validBiosNames) {
    const candidate = path.join(biosDir, name);
    if (fs.existsSync(candidate) && isFile(candidate)) return name;
  }

  // otherwise accept anything that looks like a PlayStation BIOS dump.
  try {
    const match = fs.readdirSync(biosDir).find((file) => {
      if (!isFile(path.join(biosDir, file))) return false;
      const lower = file.toLowerCase();
      return lower.endsWith(".bin") && (lower.startsWith("scph") || lower.includes("bios"));
    });
    return match ?? null;
  } catch {
    return null;
  }
}
