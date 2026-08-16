import { useEffect, useMemo, useState } from "react";
import type { ConsoleID } from "../../../shared/types";
import { biosClient } from "../../clients/biosClient";
import { NOTIFICATION_MESSAGES } from "../../../shared/constants";
import { engineClient } from "../../clients/engineClient";
import type { BiosStatus } from "../../../shared/types/bios";
import { useLayoutContext } from "../../app/layoutContext";
import { Button, PageLayout } from "../../ui";
import { useNotifications } from "../../app/notifications/NotificationProvider";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import BiosRow from "./BiosRow";
import { sortBios } from "./biosModel";

export default function Bios() {
  const [items, setItems] = useState<BiosStatus[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [engineInstalled, setEngineInstalled] = useState<Record<ConsoleID, boolean>>({} as Record<ConsoleID, boolean>);

  const { lastBiosUpdate } = useLayoutContext();
  const { notify, durations } = useNotifications();

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
      notify(NOTIFICATION_MESSAGES.ERROR_MESSAGE((err as Error).message), { type: 'error', duration: durations.long });
      setItems([]);
      setEngineInstalled({} as Record<ConsoleID, boolean>);
    } finally {
      setLoading(false);
    }
  };

  const { run, busyKey } = useAsyncAction({ onDone: refresh });

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!lastBiosUpdate) return;
    void refresh();
  }, [lastBiosUpdate]);

  const doDelete = (consoleId: ConsoleID, fileName: string): void =>
    void run(consoleId, () => biosClient.deleteBios({ consoleId, fileName }), {
      success: NOTIFICATION_MESSAGES.BIOS_REMOVED(fileName),
    });

  const sorted = useMemo(() => sortBios(items), [items]);

  const actions = (
    <div className="flex items-center gap-3">
      <Button onClick={() => void refresh()} disabled={loading || busyKey !== null}>
        Refresh
      </Button>
    </div>
  );

  return (
    <PageLayout
      title="BIOS"
      actions={actions}
      loading={!items && loading}
      empty={!items ? <div className="p-6 text-fg-muted">No data yet.</div> : undefined}
    >
      <div className="px-6 pb-10 space-y-4">
        {sorted.map((b) => (
          <BiosRow
            key={b.consoleId}
            bios={b}
            engineInstalled={engineInstalled[b.consoleId] ?? false}
            busy={busyKey === b.consoleId}
            anyBusy={busyKey !== null}
            onDelete={(fileName) => doDelete(b.consoleId, fileName)}
          />
        ))}

        {sorted.length === 0 ? (
          <div className="text-fg-muted p-6">No consoles currently require BIOS.</div>
        ) : null}
      </div>
    </PageLayout>
  );
}