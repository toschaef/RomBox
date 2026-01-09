import { useEffect, useMemo, useState, useRef } from "react";
import type { EngineInfo, EngineStatus, ConsoleID, EmulatorID } from "../../../shared/types";
import { engineClient } from "../../clients/engineClient";
import { getConsoleNameFromId, getEmulatorIdFromConsoleId, ENGINE_MAP } from "../../../shared/constants";

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function statusLabel(s: EngineStatus): string {
  if (s === "installed") return "Installed";
  if (s === "not_installed") return "Not installed";
  if (s === "broken") return "Broken";
  return "Unsupported";
}

function statusPillClass(s: EngineStatus): string {
  if (s === "installed") return "border-border-highlight text-fg-primary bg-bg-muted";
  if (s === "not_installed") return "border-border-subtle text-fg-secondary bg-bg-secondary";
  if (s === "broken") return "border-border-muted text-fg-primary bg-bg-secondary";
  return "border-border-subtle text-fg-muted bg-bg-secondary";
}

type ActionState =
  | { kind: "idle" }
  | { kind: "working"; emulatorId: EmulatorID; action: "install" | "delete" | "repair" };

type EmulatorRow = {
  emulatorId: EmulatorID;
  displayName: string;
  platform: string;
  consoles: ConsoleID[];
  status: EngineStatus;

  needsBios: boolean;
  biosInstalled: boolean;
  biosMissingFiles: string[];

  lastError?: string;
};

const PRIMARY_CONSOLE_FOR_EMULATOR: Record<EmulatorID, ConsoleID> = {
  dolphin: "gc",
  azahar: "3ds",
  melonds: "ds",
  ares: "n64",
  mesen: "snes",
};

function aggregateStatus(list: EngineInfo[]): EngineStatus {
  const statuses = list.map((e) => e.status);

  if (statuses.length === 0) return "unsupported";
  if (statuses.every((s) => s === "unsupported")) return "unsupported";
  if (statuses.some((s) => s === "broken")) return "broken";
  if (statuses.every((s) => s === "installed")) return "installed";

  return "not_installed";
}

export default function Engines() {
  const [engines, setEngines] = useState<EngineInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string>("");
  const [menuOpenFor, setMenuOpenFor] = useState<EmulatorID | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuOpenFor) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;

      if (menuRef.current?.contains(t)) return;
      if (menuButtonRef.current?.contains(t)) return;

      setMenuOpenFor(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenFor(null);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpenFor]);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await engineClient.getEngines();
      setEngines(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    engineClient.onInstallStatusUpdate((s) => setInstallStatus(s));
  }, []);

  const rows = useMemo<EmulatorRow[]>(() => {
    const list = engines ?? [];
    const groups = new Map<EmulatorID, EngineInfo[]>();

    for (const e of list) {
      const emuId = getEmulatorIdFromConsoleId(e.consoleId as ConsoleID);
      const arr = groups.get(emuId) ?? [];
      arr.push(e);
      groups.set(emuId, arr);
    }

    const order: EmulatorID[] = ["dolphin", "azahar", "melonds", "ares", "mesen"];
    const out: EmulatorRow[] = [];

    for (const emuId of order) {
      const arr = groups.get(emuId) ?? [];
      if (arr.length === 0) continue;

      const consoles = arr.map((x) => x.consoleId as ConsoleID);
      const status = aggregateStatus(arr);
      const platform = arr[0].platform;

      const needsBios = arr.some((x) => x.needsBios);
      const biosInstalled = needsBios ? arr.every((x) => !x.needsBios || x.biosInstalled) : true;

      const missing = new Set<string>();
      for (const e of arr) {
        if (e.needsBios && !e.biosInstalled) {
          for (const f of e.biosMissingFiles) missing.add(f);
        }
      }

      const firstErr = arr.find((x) => x.status === "broken" && x.lastError)?.lastError;

      const primaryConsole = PRIMARY_CONSOLE_FOR_EMULATOR[emuId];
      const displayName = ENGINE_MAP[primaryConsole] ?? emuId;

      out.push({
        emulatorId: emuId,
        displayName,
        platform,
        consoles,
        status,
        needsBios,
        biosInstalled,
        biosMissingFiles: Array.from(missing),
        lastError: firstErr,
      });
    }

    return out;
  }, [engines]);

  const busyEmu = action.kind === "working" ? action.emulatorId : null;

  const doInstall = async (row: EmulatorRow) => {
    setAction({ kind: "working", emulatorId: row.emulatorId, action: "install" });
    setToast(null);
    setInstallStatus("");

    try {
      const r = await engineClient.installEngine(row.emulatorId);
      if (!r.success) throw new Error(r.message || r.error || "Install failed");
      setToast(`${row.displayName} installed.`);
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setAction({ kind: "idle" });
      await refresh();
    }
  };

  const doDelete = async (row: EmulatorRow) => {
    setAction({ kind: "working", emulatorId: row.emulatorId, action: "delete" });
    setToast(null);
    setInstallStatus("");

    try {
      const r = await engineClient.deleteEngine(row.emulatorId);
      if (!r.success) throw new Error(r.message || r.error || "Uninstall failed");
      setToast(`${row.displayName} removed.`);
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setAction({ kind: "idle" });
      await refresh();
    }
  };

  const doRepair = async (row: EmulatorRow) => {
    setAction({ kind: "working", emulatorId: row.emulatorId, action: "repair" });
    setToast(null);
    setInstallStatus("");

    try {
      const del = await engineClient.deleteEngine(row.emulatorId);
      if (!del.success) throw new Error(del.message || del.error || "Delete failed during repair");

      const ins = await engineClient.installEngine(row.emulatorId);
      if (!ins.success) throw new Error(ins.message || ins.error || "Install failed during repair");

      setToast(`${row.displayName} repaired.`);
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setAction({ kind: "idle" });
      await refresh();
    }
  };

  const pageHeader = (
    <div className="flex items-start justify-between gap-4 p-6">
      <div>
        <h1 className="w-full text-3xl font-bold py-4 text-fg-primary">Engines</h1>

        {installStatus ? (
          <div className="mt-3 text-base text-fg-secondary">
            <span className="uppercase tracking-widest font-bold text-fg-muted mr-2">Install</span>
            {installStatus}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void refresh()}
          className={clsx(
            "px-4 py-3 rounded-xl border text-base font-bold transition-colors",
            "bg-bg-secondary border-border-subtle text-fg-primary hover:border-border-muted"
          )}
          disabled={loading || action.kind === "working"}
        >
          Refresh
        </button>

        <button
          type="button"
          onClick={() => void engineClient.clear().then(() => refresh())}
          className={clsx(
            "px-4 py-3 rounded-xl border text-base font-bold transition-colors",
            "bg-bg-secondary border-border-subtle text-fg-secondary hover:text-fg-primary hover:border-border-muted"
          )}
          disabled={loading || action.kind === "working"}
          title="Removes all installed engine files and platform config data"
        >
          Delete all
        </button>
      </div>
    </div>
  );

  if (!engines) {
    return (
      <div className="h-full w-full overflow-y-auto">
        {pageHeader}
        <div className="p-6 text-fg-muted text-base">{loading ? "Loading..." : "No data yet."}</div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-y-auto">
      {pageHeader}

      {toast ? (
        <div className="px-6 pb-4">
          <div className="rounded-xl border border-border-subtle bg-bg-secondary p-4 text-base text-fg-secondary">
            {toast}
          </div>
        </div>
      ) : null}

      <div className="px-6 pb-10 space-y-4">
        {rows.map((row) => {
          const isBusy = busyEmu === row.emulatorId;

          const supportsText = row.consoles
            .slice()
            .sort()
            .map((c) => getConsoleNameFromId(c))
            .join(", ");

          return (
            <div key={row.emulatorId} className="rounded-2xl border border-border-subtle bg-bg-secondary">
              <div className="p-6 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-fg-primary text-xl font-bold">{row.displayName}</div>

                    <span
                      className={clsx(
                        "inline-flex items-center px-3 py-1 rounded-lg border text-sm font-bold",
                        statusPillClass(row.status)
                      )}
                    >
                      {statusLabel(row.status)}
                    </span>

                    {row.needsBios ? (
                      row.biosInstalled ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-lg border border-border-subtle text-sm font-bold text-fg-secondary bg-bg-secondary">
                          BIOS OK
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-lg border border-fg-primary text-sm font-bold text-fg-secondary bg-bg-secondary"
                          title={row.biosMissingFiles.join(", ")}
                        >
                          BIOS missing
                        </span>
                      )
                    ) : null}
                  </div>

                  <div className="mt-3 text-fg-muted text-base">
                    Supports: <span className="text-fg-secondary font-bold">{supportsText}</span>
                  </div>

                  {!row.biosInstalled && row.biosMissingFiles.length ? (
                    <div className="mt-3 text-base text-fg-muted">
                      Missing BIOS: <span className="text-fg-secondary">{row.biosMissingFiles.join(", ")}</span>
                    </div>
                  ) : null}

                  {row.status === "broken" && row.lastError ? (
                    <div className="mt-3 text-base text-fg-secondary">
                      <span className="uppercase tracking-widest font-bold text-fg-muted mr-2">Error</span>
                      {row.lastError}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-3 shrink-0">
                  {row.status === "not_installed" ? (
                    <button
                      type="button"
                      onClick={() => void doInstall(row)}
                      disabled={isBusy || action.kind === "working"}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-lg font-bold transition-colors",
                        "bg-accent-secondary text-white hover:bg-accent-primary",
                        (isBusy || action.kind === "working") && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      Install
                    </button>
                  ) : null}

                  {row.status === "installed" || row.status === "broken" ? (
                    <div className="relative">
                      <button
                        ref={menuButtonRef}
                        type="button"
                        aria-label="More options"
                        onClick={() => setMenuOpenFor((cur) => (cur === row.emulatorId ? null : row.emulatorId))}
                        disabled={isBusy || action.kind === "working"}
                        className={clsx(
                          "h-12 w-12 rounded-xl border flex items-center justify-center transition-colors",
                          "bg-bg-secondary border-border-subtle text-fg-secondary hover:text-fg-primary hover:border-border-muted",
                          (isBusy || action.kind === "working") && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        <span className="text-xl leading-none">⋯</span>
                      </button>

                      {menuOpenFor === row.emulatorId ? (
                        <div
                          className="absolute right-0 top-14 z-20 w-56 rounded-xl border border-border-subtle bg-bg-secondary shadow-lg overflow-hidden"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenFor(null);
                              void doRepair(row);
                            }}
                            disabled={isBusy || action.kind === "working"}
                            className={clsx( "w-full text-left px-4 py-3 text-base font-bold transition-colors", "text-fg-primary hover:bg-bg-muted", (isBusy || action.kind === "working") && "opacity-60 cursor-not-allowed" )}
                          >
                            Repair
                          </button>

                          <div className="h-px bg-border-subtle" />

                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenFor(null);
                              void doDelete(row);
                            }}
                           disabled={isBusy || action.kind === "working"}
                           className={clsx("w-full text-left px-4 py-3 text-base font-bold transition-colors", "text-fg-primary hover:bg-bg-muted", (isBusy || action.kind === "working") && "opacity-60 cursor-not-allowed")}
                          >
                            Uninstall
                          </button>
                        </div>
                      ) : null}
                      </div>
                  ) : null}

                  {row.status === "unsupported" ? (
                    <button
                      type="button"
                      disabled
                      className={clsx(
                        "px-6 py-4 rounded-xl border text-lg font-bold",
                        "bg-bg-secondary border-border-subtle text-fg-muted opacity-60 cursor-not-allowed"
                      )}
                      title="No download/binary configured for this platform"
                    >
                      Unsupported
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}