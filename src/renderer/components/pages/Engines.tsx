import { useEffect, useMemo, useState, useRef } from "react";
import type { ConsoleID } from "../../../shared/types";
import type { EngineID } from "../../../shared/types/engines";
import type { EngineInfo, EngineStatus } from "../../../shared/types/engines";
import { engineClient } from "../../clients/engineClient";
import { getConsoleNameFromId, getEngineIdFromConsoleId, ENGINE_MAP } from "../../../shared/constants";

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
  | { kind: "working"; engineId: EngineID; action: "install" | "delete" | "repair" };

type EmulatorRow = {
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

const PRIMARY_CONSOLE_FOR_EMULATOR: Record<EngineID, ConsoleID> = {
  dolphin: "gc",
  azahar: "3ds",
  melonds: "ds",
  ares: "n64",
  rmg: "n64",
  mesen: "snes",
};

export default function Engines() {
  const [engines, setEngines] = useState<EngineInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string>("");
  const [menuOpenFor, setMenuOpenFor] = useState<EngineID | null>(null);

  console.log("[Engines] engines:", engines);

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
    } catch (err) {
      console.error("[Engines] getEngines failed", err);
      setToast((err as Error).message);
      setEngines([]);
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

    const PREFERRED_ORDER: EngineID[] = ["dolphin", "azahar", "melonds", "ares", "rmg", "mesen"];
    const orderIndex = new Map<EngineID, number>(PREFERRED_ORDER.map((id, i) => [id, i]));

    return list
      .filter((e) => e.status !== "unsupported")
      .slice()
      .sort((a, b) => {
        const ia = orderIndex.get(a.engineId) ?? 999;
        const ib = orderIndex.get(b.engineId) ?? 999;
        if (ia !== ib) return ia - ib;
        return a.engineId.localeCompare(b.engineId);
      })
      .map((e) => {
        const primaryConsole = PRIMARY_CONSOLE_FOR_EMULATOR[e.engineId];
        const displayName = ENGINE_MAP[primaryConsole] ?? e.name ?? e.engineId;

        const req = e.biosMissingRequired.map((x) => `${x.consoleId}:${x.filename}`);
        const warn = e.biosMissingWarning.map((x) => `${x.consoleId}:${x.filename}`);

        return {
          engineId: e.engineId,
          displayName,
          platform: e.platform,
          consoles: e.consoles,
          status: e.status,
          needsBios: e.needsBios,
          biosState: e.biosState,
          biosMissingRequired: req,
          biosMissingWarning: warn,
          lastError: e.lastError,
        };
      });
  }, [engines]);

  const busyEmu = action.kind === "working" ? action.engineId : null;

  const doInstall = async (row: EmulatorRow) => {
    setAction({ kind: "working", engineId: row.engineId, action: "install" });
    setToast(null);
    setInstallStatus("");

    try {
      const r = await engineClient.installEngine(row.engineId);
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
    setAction({ kind: "working", engineId: row.engineId, action: "delete" });
    setToast(null);
    setInstallStatus("");

    try {
      const r = await engineClient.deleteEngine(row.engineId);
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
    setAction({ kind: "working", engineId: row.engineId, action: "repair" });
    setToast(null);
    setInstallStatus("");

    try {
      const del = await engineClient.deleteEngine(row.engineId);
      if (!del.success) throw new Error(del.message || del.error || "Delete failed during repair");

      const ins = await engineClient.installEngine(row.engineId);
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
        <h1 className="w-full text-3xl font-bold py-4 px-2 text-fg-primary">Engines</h1>

        {/* {installStatus ? (
          <div className="mt-3 text-base text-fg-secondary">
            <span className="uppercase tracking-widest font-bold text-fg-muted mr-2">Install</span>
            {installStatus}
          </div>
        ) : null} */}
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
          Repair All
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

      {/* {toast ? (
        <div className="px-6 pb-4">
          <div className="rounded-xl border border-border-subtle bg-bg-secondary p-4 text-base text-fg-secondary">
            {toast}
          </div>
        </div>
      ) : null} */}

      <div className="px-6 pb-10 space-y-4">
        {rows.map((row) => {
          const isBusy = busyEmu === row.engineId;

          const supportsText = row.consoles
            .slice()
            .sort()
            .map((c) => getConsoleNameFromId(c))
            .join(", ");

          return (
            <div key={row.engineId} className="rounded-2xl border border-border-subtle bg-bg-secondary">
              <div className="p-6 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-fg-primary text-l font-bold">{row.displayName}</div>

                    <span
                      className={clsx(
                        "inline-flex items-center px-2 py-1 rounded-lg border text-xs font-bold",
                        statusPillClass(row.status)
                      )}
                    >
                      {statusLabel(row.status)}
                    </span>

                    {row.needsBios && row.biosState !== "none" ? (
                      row.biosState === "ok" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg border border-border-subtle text-xs font-bold text-fg-secondary bg-bg-secondary">
                          BIOS OK
                        </span>
                      ) : row.biosState === "warning" ? (
                        <span
                          className="inline-flex items-center px-2 py-1 rounded-lg border border-border-muted text-xs font-bold text-fg-secondary bg-bg-secondary"
                          title={row.biosMissingWarning.join(", ")}
                        >
                          BIOS warning
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center px-2 py-1 rounded-lg border border-fg-primary text-xs font-bold text-fg-secondary bg-bg-secondary"
                          title={row.biosMissingRequired.join(", ")}
                        >
                          BIOS missing
                        </span>
                      )
                    ) : null}
                  </div>

                  <div className="mt-3 text-fg-muted text-sm">
                    Supports: <span className="text-fg-secondary font-medium">{supportsText}</span>
                  </div>

                  {row.needsBios && row.biosState === "missing" && row.biosMissingRequired.length ? (
                    <div className="mt-3 text-sm text-fg-muted">
                      Missing required BIOS:{" "}
                      <span className="text-fg-secondary">{row.biosMissingRequired.join(", ")}</span>
                    </div>
                  ) : null}

                  {row.needsBios && row.biosState === "warning" && row.biosMissingWarning.length ? (
                    <div className="mt-3 text-sm text-fg-muted">
                      Missing optional BIOS:{" "}
                      <span className="text-fg-secondary">{row.biosMissingWarning.join(", ")}</span>
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
                        onClick={() => setMenuOpenFor((cur) => (cur === row.engineId ? null : row.engineId))}
                        disabled={isBusy || action.kind === "working"}
                        className={clsx(
                          "h-12 w-12 rounded-xl border flex items-center justify-center transition-colors",
                          "bg-bg-secondary border-border-subtle text-fg-secondary hover:text-fg-primary hover:border-border-muted",
                          (isBusy || action.kind === "working") && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        <span className="text-xl leading-none">⋯</span>
                      </button>

                      {menuOpenFor === row.engineId ? (
                        <div
                          ref={menuRef}
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