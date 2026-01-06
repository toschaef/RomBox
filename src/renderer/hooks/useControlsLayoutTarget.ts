import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnyConsoleLayout, ControlsProfile } from "../../shared/controls/types";
import type { ConsoleID } from "../../shared/types";
import { controlsClient } from "../clients/controlsClient";
import { CONSOLE_OPTIONS } from "../controls/consoleLayouts";

export type LayoutTarget =
  | { kind: "standard" }
  | { kind: "console"; consoleId: ConsoleID };

export function useControlsLayoutTarget(args: {
  profile: ControlsProfile | null;
  profileId: string | null;
}) {
  const { profile, profileId } = args;

  const [target, setTarget] = useState<LayoutTarget>({ kind: "standard" });
  const [consoleLayout, setConsoleLayout] = useState<AnyConsoleLayout | null>(null);
  const [layoutSaving, setLayoutSaving] = useState(false);

  const isConsoleMode = target.kind === "console";
  const consoleId: ConsoleID | null = isConsoleMode ? target.consoleId : null;

  useEffect(() => {
    if (!profileId) return;

    if (!isConsoleMode || !consoleId) {
      setConsoleLayout(null);
      return;
    }

    void (async () => {
      const layout = await controlsClient.getConsoleLayout({ consoleId, profileId });
      setConsoleLayout(layout);
    })();
  }, [profileId, isConsoleMode, consoleId]);

  const consoleOptions = useMemo(() => CONSOLE_OPTIONS, []);

  const setStandard = useCallback((): void => setTarget({ kind: "standard" }), []);
  const setConsole = useCallback((id: ConsoleID): void => setTarget({ kind: "console", consoleId: id }), []);

  const saveConsoleLayout = useCallback(
    async (next: AnyConsoleLayout): Promise<void> => {
      setConsoleLayout(next);
      if (!profileId) return;

      setLayoutSaving(true);
      try {
        const saved = await controlsClient.saveConsoleLayout({
          consoleId: next.consoleId,
          profileId,
          bindings: next.bindings,
        });
        setConsoleLayout(saved);
      } finally {
        setLayoutSaving(false);
      }
    },
    [profileId]
  );

  const resetConsoleLayout = useCallback(
    async (id: ConsoleID): Promise<void> => {
      if (!profileId) return;

      setLayoutSaving(true);
      try {
        const reset = await controlsClient.resetConsoleLayout({ consoleId: id, profileId });
        setConsoleLayout(reset);
      } finally {
        setLayoutSaving(false);
      }
    },
    [profileId]
  );

  return {
    target,
    setStandard,
    setConsole,

    consoleOptions,

    isConsoleMode,
    consoleId,

    consoleLayout,
    setConsoleLayout,
    saveConsoleLayout,
    resetConsoleLayout,
    layoutSaving,

    profile,
  };
}