import type { BiosStatus } from "../../../shared/types/bios";

export type BiosTone = "ok" | "warn" | "bad" | "neutral";

const AZAHAR_WANT = ["nand", "sysdata", "sdmc"] as const;

export function statusFor(item: BiosStatus, engineIsInstalled: boolean): { label: string; tone: BiosTone } {
  if (!item.needsBios) return { label: "No BIOS needed", tone: "neutral" };

  if (!engineIsInstalled) {
    return item.cachedFiles.length
      ? { label: "Saved in cache", tone: "neutral" }
      : { label: "Not set up yet", tone: "warn" };
  }

  if (item.biosState === "ok") return { label: "BIOS OK", tone: "ok" };
  if (item.biosState === "warning") return { label: "BIOS optional", tone: "warn" };
  if (item.biosState === "missing") return { label: "BIOS missing", tone: "bad" };
  return { label: "No BIOS", tone: "neutral" };
}

export function computeInstalledList(b: BiosStatus): string[] {
  if (b.consoleId === "3ds") {
    const missing = new Set((b.missingWarningFiles ?? []).map((x) => x.toLowerCase()));
    return AZAHAR_WANT.filter((x) => !missing.has(x));
  }
  return (b.cachedFiles ?? []).slice();
}

export function menuFilesFor(b: BiosStatus): string[] {
  const missingReq = b.missingRequiredFiles ?? [];
  const missingWarn = b.missingWarningFiles ?? [];
  if (b.consoleId === "3ds") return computeInstalledList(b);
  if (b.cachedFiles?.length) return b.cachedFiles;
  return missingReq.length ? missingReq : missingWarn;
}

export function sortBios(items: BiosStatus[] | null): BiosStatus[] {
  const rank = (x: BiosStatus) => {
    if (!x.needsBios) return 4;
    if (x.biosState === "missing") return 0;
    if (x.biosState === "warning") return 1;
    if (x.biosState === "ok") return 2;
    return 3;
  };

  return (items ?? []).slice().sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.consoleId.localeCompare(b.consoleId);
  });
}
