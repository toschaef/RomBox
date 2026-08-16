import { useEffect, useMemo, useState } from "react";
import type { EngineInfo } from "../../../shared/types/engines";
import { engineClient } from "../../clients/engineClient";
import { NOTIFICATION_MESSAGES } from "../../../shared/constants";
import { Button, PageLayout } from "../../ui";
import { useLayoutContext } from "../../app/layoutContext";
import { useNotifications } from "../../app/notifications/NotificationProvider";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import EngineRow from "./EngineRow";
import { toRows, type EngineRowModel } from "./enginesModel";

export default function Engines() {
  const [engines, setEngines] = useState<EngineInfo[] | null>(null);
  const [loading, setLoading] = useState(false);

  const { setGlobalLoading, setGlobalStatus } = useLayoutContext();
  const { notify, durations } = useNotifications();

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await engineClient.getEngines();
      setEngines(list);
    } catch (err) {
      console.error("[Engines] getEngines failed", err);
      notify(NOTIFICATION_MESSAGES.ERROR_MESSAGE((err as Error).message), { type: 'error', duration: durations.long });
      setEngines([]);
    } finally {
      setLoading(false);
    }
  };

  const { run, busyKey } = useAsyncAction({
    setStatus: setGlobalStatus,
    setLoading: setGlobalLoading,
    onDone: refresh,
  });

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const remove = engineClient.onInstallStatusUpdate((s) => {
      if (s && s !== "complete") setGlobalStatus(s);
    });
    return () => { if (remove) remove(); };
  }, [setGlobalStatus]);

  const rows = useMemo(() => toRows(engines), [engines]);

  const doInstall = (row: EngineRowModel): void =>
    void run(row.engineId, () => engineClient.installEngine(row.engineId), {
      status: `Installing ${row.displayName}...`,
      success: NOTIFICATION_MESSAGES.ENGINE_INSTALLED(row.displayName),
    });

  const doDelete = (row: EngineRowModel): void =>
    void run(row.engineId, () => engineClient.deleteEngine(row.engineId), {
      status: `Deleting ${row.displayName}...`,
      success: NOTIFICATION_MESSAGES.ENGINE_UNINSTALLED(row.displayName),
    });

  const doRepair = (row: EngineRowModel): void =>
    void run(row.engineId, () => engineClient.repairEngine(row.engineId), {
      status: `Repairing ${row.displayName}...`,
      success: NOTIFICATION_MESSAGES.ENGINE_REPAIRED(row.displayName),
    });

  const actions = (
    <div className="flex items-center gap-3">
      <Button onClick={() => void refresh()} disabled={loading || busyKey !== null}>
        Repair All
      </Button>
      <Button
        onClick={() => void engineClient.clear().then(() => refresh())}
        disabled={loading || busyKey !== null}
        title="Removes all installed engine files and platform config data"
      >
        Delete all
      </Button>
    </div>
  );

  return (
    <PageLayout
      title="Engines"
      actions={actions}
      loading={!engines && loading}
      empty={!engines ? <div className="p-6 text-fg-muted text-base">No data yet.</div> : undefined}
    >
      <div className="px-6 pb-10 space-y-4">
        {rows.map((row) => (
          <EngineRow
            key={row.engineId}
            row={row}
            busy={busyKey === row.engineId}
            anyBusy={busyKey !== null}
            onInstall={() => doInstall(row)}
            onRepair={() => doRepair(row)}
            onDelete={() => doDelete(row)}
          />
        ))}
      </div>
    </PageLayout>
  );
}