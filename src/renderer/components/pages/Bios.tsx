import { useEffect, useMemo, useRef, useState } from "react";
import type { ConsoleID } from "../../../shared/types";
import { biosClient } from "../../clients/biosClient";
import { getConsoleNameFromId } from "../../../shared/constants";
import { engineClient } from "../../clients/engineClient";
import type { BiosStatus } from "../../../shared/types/bios";
import { useOutletContext } from "react-router-dom";
import type { LayoutContextType } from "../layout";
import PageLayout from "../layout/PageLayout";


function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type ActionState =
  | { kind: "idle" }
  | { kind: "working"; consoleId: ConsoleID; action: "install" | "delete" };

function pillClass(kind: "ok" | "warn" | "bad" | "neutral") {
  if (kind === "ok") return "border-border-subtle text-fg-secondary bg-bg-secondary";
  if (kind === "warn") return "border-border-muted text-fg-primary bg-bg-secondary";
  if (kind === "bad") return "border-fg-primary text-fg-secondary bg-bg-secondary";
  return "border-border-subtle text-fg-muted bg-bg-secondary";
}

function statusFor(item: BiosStatus, engineIsInstalled: boolean) {
  if (!item.needsBios) return { label: "No BIOS needed", kind: "neutral" as const };

  if (!engineIsInstalled) {
    return item.cachedFiles.length
      ? { label: "Saved in cache", kind: "neutral" as const }
      : { label: "Not set up yet", kind: "warn" as const };
  }

  if (item.biosState === "ok") return { label: "BIOS OK", kind: "ok" as const };
  if (item.biosState === "warning") return { label: "BIOS optional", kind: "warn" as const };
  if (item.biosState === "missing") return { label: "BIOS missing", kind: "bad" as const };
  return { label: "No BIOS", kind: "neutral" as const };
}

const AZAHAR_WANT = ["nand", "sysdata", "sdmc"] as const;

function computeInstalledList(b: BiosStatus): string[] {
  if (b.consoleId === "3ds") {
    const missing = new Set((b.missingWarningFiles ?? []).map((x) => x.toLowerCase()));
    return AZAHAR_WANT.filter((x) => !missing.has(x));
  }
  return (b.cachedFiles ?? []).slice();
}

export default function Bios() {
  const [items, setItems] = useState<BiosStatus[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const [engineInstalled, setEngineInstalled] = useState<Record<ConsoleID, boolean>>({} as Record<ConsoleID, boolean>);
  const { lastBiosUpdate } = useOutletContext<LayoutContextType>();

  const [menuOpenFor, setMenuOpenFor] = useState<ConsoleID | null>(null);
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
      const r = await biosClient.getAll();
      if (!r.success) throw new Error(r.message || r.error || "Failed to load BIOS status");
      const list = r.items ?? [];
      setItems(list);

      const engines = await engineClient.getEngines();
      const installedEngineIds = new Set(
        engines.filter((e) => e.status === "installed").map((e) => e.engineId)
      );

      const pairs = list.map((it) => [it.consoleId, installedEngineIds.has(it.engineId)] as const);
      setEngineInstalled(Object.fromEntries(pairs) as Record<ConsoleID, boolean>);
    } catch (err) {
      console.error("[BiosPage] refresh failed:", err);
      setToast((err as Error).message);
      setItems([]);
      setEngineInstalled({} as Record<ConsoleID, boolean>);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!lastBiosUpdate) return;
    void refresh();
  }, [lastBiosUpdate]);

  const busy = action.kind === "working" ? action.consoleId : null;

  const doDelete = async (consoleId: ConsoleID, fileName: string) => {
    setAction({ kind: "working", consoleId, action: "delete" });
    setToast(null);

    try {
      const r = await biosClient.deleteBios({ consoleId, fileName });
      if (!r.success) throw new Error(r.message || r.error || "Delete failed");
      setToast(`${getConsoleNameFromId(consoleId)}: removed ${fileName}.`);
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setAction({ kind: "idle" });
      await refresh();
    }
  };

  const sorted = useMemo(() => {
    const list = items ?? [];
    const rank = (x: BiosStatus) => {
      if (!x.needsBios) return 4;
      if (x.biosState === "missing") return 0;
      if (x.biosState === "warning") return 1;
      if (x.biosState === "ok") return 2;
      return 3;
    };

    return list.slice().sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.consoleId.localeCompare(b.consoleId);
    });
  }, [items]);

  if (!items) {
    return (
      <PageLayout
        title="BIOS"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refresh()}
              className={clsx(
                "px-3 py-1.5 border text-xs font-bold transition-colors rounded-none",
                "bg-bg-secondary border-border-subtle text-fg-primary hover:border-border-muted"
              )}
              disabled={loading || action.kind === "working"}
            >
              Refresh
            </button>
          </div>
        }
      >
        <div className="p-6 text-fg-muted">{loading ? "Loading..." : "No data yet."}</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="BIOS"
      actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className={clsx(
              "px-3 py-1.5 border text-xs font-bold transition-colors rounded-none",
              "bg-bg-secondary border-border-subtle text-fg-primary hover:border-border-muted"
            )}
            disabled={loading || action.kind === "working"}
          >
            Refresh
          </button>
        </div>
      }
    >
      <div className="px-6 pb-10 space-y-4">
        {sorted.map((b) => {
          const engOk = engineInstalled[b.consoleId] ?? false;
          const s = statusFor(b, engOk);
          const isBusy = busy === b.consoleId;

          const missingReq = b.missingRequiredFiles ?? [];
          const missingWarn = b.missingWarningFiles ?? [];

          const showReq = engOk && missingReq.length > 0;
          const showWarn = engOk && missingReq.length === 0 && missingWarn.length > 0;

          const installedList = computeInstalledList(b);
          const menuFiles: string[] =
            b.consoleId === "3ds"
              ? installedList
              : ((b.cachedFiles?.length ? b.cachedFiles : (missingReq.length ? missingReq : missingWarn)) ?? []);

          return (
            <div key={b.consoleId} className="rounded-sm border border-border-subtle bg-bg-secondary">
              <div className="p-5 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-fg-primary text-lg font-bold">{getConsoleNameFromId(b.consoleId)}</div>

                    <span
                      className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded-xs border text-[10px] uppercase font-bold tracking-wider",
                        pillClass(s.kind)
                      )}
                      title={!b.required ? "Optional files improve compatibility but are not required." : undefined}
                    >
                      {s.label}
                    </span>

                    {b.needsBios ? (
                      <span
                        className={clsx(
                          "inline-flex items-center px-2 py-0.5 rounded-xs border text-[10px] uppercase font-bold tracking-wider",
                          pillClass(engOk ? "ok" : "neutral")
                        )}
                        title={engOk ? "Engine installed" : "Install the engine to apply BIOS to its firmware folder"}
                      >
                        {engOk ? "Engine installed" : `${b.consoleId.toUpperCase()} engine not installed`}
                      </span>
                    ) : null}
                  </div>

                  {showReq ? (
                    <div className="mt-3 text-xs text-fg-muted">
                      Missing required: <span className="text-fg-secondary">{missingReq.join(", ")}</span>
                    </div>
                  ) : null}

                  {showWarn ? (
                    <div className="mt-3 text-xs text-fg-muted">
                      Missing optional: <span className="text-fg-secondary">{missingWarn.join(", ")}</span>
                    </div>
                  ) : null}

                  {b.needsBios ? (
                    <div className="mt-2 text-xs text-fg-muted">
                      Installed:{" "}
                      <span className="text-fg-secondary">
                        {installedList.length ? installedList.join(", ") : "None"}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-3 shrink-0">
                  {b.needsBios ? (
                    <>
                      {installedList.length ? (
                        <div className="relative">
                          <button
                            ref={menuButtonRef}
                            type="button"
                            aria-label="More options"
                            onClick={() => setMenuOpenFor((cur) => (cur === b.consoleId ? null : b.consoleId))}
                            disabled={isBusy || action.kind === "working"}
                            className={clsx(
                              "h-8 w-8 rounded-sm border flex items-center justify-center transition-colors",
                              "bg-bg-secondary border-border-subtle text-fg-secondary hover:text-fg-primary hover:border-border-muted",
                              (isBusy || action.kind === "working") && "opacity-60 cursor-not-allowed"
                            )}
                            title="More"
                          >
                            <span className="text-lg leading-none">{'\u22EF'}</span>
                          </button>

                          {menuOpenFor === b.consoleId ? (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-10 z-20 w-64 rounded-sm border border-border-subtle bg-bg-secondary shadow-lg overflow-hidden"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <div className="px-4 py-2 text-xs text-fg-muted">
                                {b.consoleId === "3ds" ? "Remove a 3DS system folder (will probably break it)" : "Remove a specific BIOS file"}
                              </div>

                              <div className="h-px bg-border-subtle" />

                              {menuFiles.map((fileName) => (
                                <button
                                  key={fileName}
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenFor(null);
                                    void doDelete(b.consoleId, fileName);
                                  }}
                                  disabled={isBusy || action.kind === "working"}
                                  className={clsx(
                                    "w-full text-left px-4 py-2 text-sm font-semibold transition-colors",
                                    "text-fg-primary hover:bg-bg-muted",
                                    (isBusy || action.kind === "working") && "opacity-60 cursor-not-allowed"
                                  )}
                                  title="Deletes from cache and firmware folder"
                                >
                                  Delete {fileName}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className={clsx(
                        "px-3 py-1.5 rounded-sm border text-xs uppercase font-bold tracking-wider",
                        "bg-bg-secondary border-border-subtle text-fg-muted opacity-60 cursor-not-allowed"
                      )}
                    >
                      Installed
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 ? (
          <div className="text-fg-muted p-6">No consoles currently require BIOS.</div>
        ) : null}
      </div>
    </PageLayout>
  );
}