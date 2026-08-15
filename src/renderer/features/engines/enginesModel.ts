import type { ConsoleID } from "../../../shared/types";
import type { EngineID, EngineInfo, EngineStatus } from "../../../shared/types/engines";

export type EngineRowModel = {
  engineId: EngineID;
  displayName: string;
  platform: string;
  consoles: ConsoleID[];
  status: EngineStatus;

  needsBios: boolean;
  biosState: "ok" | "warning" | "missing" | "none";
  biosMissingRequired: string[];
  biosMissingWarning: string[];

  lastError?: string;
};

export const PREFERRED_ORDER: EngineID[] = ["dolphin", "azahar", "melonds", "ares", "mesen"];

export function statusLabel(s: EngineStatus): string {
  if (s === "installed") return "Installed";
  if (s === "not_installed") return "Not installed";
  if (s === "broken") return "Broken";
  return "Unsupported";
}

export function statusTone(s: EngineStatus): "ok" | "info" | "warn" | "neutral" {
  if (s === "installed") return "ok";
  if (s === "not_installed") return "info";
  if (s === "broken") return "warn";
  return "neutral";
}

export function toRows(engines: EngineInfo[] | null): EngineRowModel[] {
  const orderIndex = new Map<EngineID, number>(PREFERRED_ORDER.map((id, i) => [id, i]));

  return (engines ?? [])
    .filter((e) => e.status !== "unsupported")
    .slice()
    .sort((a, b) => {
      const ia = orderIndex.get(a.engineId) ?? 999;
      const ib = orderIndex.get(b.engineId) ?? 999;
      if (ia !== ib) return ia - ib;
      return a.engineId.localeCompare(b.engineId);
    })
    .map((e) => ({
      engineId: e.engineId,
      displayName: e.name ?? e.engineId,
      platform: e.platform,
      consoles: e.consoles,
      status: e.status,
      needsBios: e.needsBios,
      biosState: e.biosState,
      biosMissingRequired: e.biosMissingRequired.map((x) => `${x.consoleId}:${x.filename}`),
      biosMissingWarning: e.biosMissingWarning.map((x) => `${x.consoleId}:${x.filename}`),
      lastError: e.lastError,
    }));
}
