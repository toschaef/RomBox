import { useState } from "react";
import { getConsoleNameFromId } from "../../../shared/emulators/derived";
import { useDismissable } from "../../hooks/useDismissable";
import { Button, Card, IconButton, Menu, MenuItem, MenuSeparator, Pill } from "../../ui";
import { statusLabel, statusTone, type EngineRowModel } from "./enginesModel";

type Props = {
  row: EngineRowModel;
  busy: boolean;
  anyBusy: boolean;
  onInstall: () => void;
  onRepair: () => void;
  onDelete: () => void;
};

export default function EngineRow({ row, busy, anyBusy, onInstall, onRepair, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { triggerRef, panelRef } = useDismissable<HTMLButtonElement, HTMLDivElement>(menuOpen, () =>
    setMenuOpen(false)
  );

  const disabled = busy || anyBusy;

  const supportsText = row.consoles
    .slice()
    .sort()
    .map((c) => getConsoleNameFromId(c))
    .join(", ");

  return (
    <Card data-testid="engine-row" data-engine-id={row.engineId}>
      <div className="p-6 flex items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-fg-primary text-lg font-bold">{row.displayName}</div>

            <Pill tone={statusTone(row.status)}>{statusLabel(row.status)}</Pill>

            {row.needsBios && row.biosState !== "none" ? (
              row.biosState === "ok" ? (
                <Pill tone="info">BIOS OK</Pill>
              ) : row.biosState === "warning" ? (
                <Pill tone="warn" title={row.biosMissingWarning.join(", ")}>
                  BIOS warning
                </Pill>
              ) : (
                <Pill tone="bad" title={row.biosMissingRequired.join(", ")}>
                  BIOS missing
                </Pill>
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
            <Button intent="primary" size="md" uppercase onClick={onInstall} disabled={disabled}>
              Install
            </Button>
          ) : null}

          {row.status === "installed" || row.status === "broken" ? (
            <div className="relative">
              <IconButton
                ref={triggerRef}
                size="lg"
                aria-label="More options"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                disabled={disabled}
              >
                {"⋯"}
              </IconButton>

              {menuOpen ? (
                <Menu panelRef={panelRef}>
                  <MenuItem
                    disabled={disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      onRepair();
                    }}
                  >
                    Repair
                  </MenuItem>

                  <MenuSeparator />

                  <MenuItem
                    disabled={disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    Uninstall
                  </MenuItem>
                </Menu>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
