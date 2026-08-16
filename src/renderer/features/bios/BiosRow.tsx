import { useState } from "react";
import type { BiosStatus } from "../../../shared/types/bios";
import { getConsoleNameFromId } from "../../../shared/emulators/derived";
import { useDismissable } from "../../hooks/useDismissable";
import { Button, Card, IconButton, Menu, MenuItem, MenuSeparator, Pill } from "../../ui";
import { statusFor, computeInstalledList, menuFilesFor } from "./biosModel";

type Props = {
  bios: BiosStatus;
  engineInstalled: boolean;
  busy: boolean;
  anyBusy: boolean;
  onDelete: (fileName: string) => void;
};

export default function BiosRow({ bios: b, engineInstalled, busy, anyBusy, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { triggerRef, panelRef } = useDismissable<HTMLButtonElement, HTMLDivElement>(menuOpen, () =>
    setMenuOpen(false)
  );

  const disabled = busy || anyBusy;
  const s = statusFor(b, engineInstalled);

  const missingReq = b.missingRequiredFiles ?? [];
  const missingWarn = b.missingWarningFiles ?? [];
  const showReq = engineInstalled && missingReq.length > 0;
  const showWarn = engineInstalled && missingReq.length === 0 && missingWarn.length > 0;

  const installedList = computeInstalledList(b);
  const menuFiles = menuFilesFor(b);

  return (
    <Card data-testid="bios-row" data-console-id={b.consoleId}>
      <div className="p-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-fg-primary text-lg font-bold">{getConsoleNameFromId(b.consoleId)}</div>

            <Pill
              tone={s.tone}
              size="sm"
              title={!b.required ? "Optional files improve compatibility but are not required." : undefined}
            >
              {s.label}
            </Pill>

            {b.needsBios ? (
              <Pill
                tone={engineInstalled ? "ok" : "neutral"}
                size="sm"
                title={
                  engineInstalled
                    ? "Engine installed"
                    : "Install the engine to apply BIOS to its firmware folder"
                }
              >
                {engineInstalled ? "Engine installed" : `${b.consoleId.toUpperCase()} engine not installed`}
              </Pill>
            ) : null}
          </div>

          {b.onlyNeedOne ? (
            (showReq || showWarn) && (
              <div className="mt-3 text-xs text-fg-muted">
                {showReq ? "Required (provide any one): " : "Optional (provide any one): "}
                <span className="text-fg-secondary">{(showReq ? missingReq : missingWarn).join(", ")}</span>
              </div>
            )
          ) : (
            <>
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
            </>
          )}

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
            installedList.length ? (
              <div className="relative">
                <IconButton
                  ref={triggerRef}
                  size="lg"
                  aria-label="More options"
                  aria-expanded={menuOpen}
                  title="More"
                  onClick={() => setMenuOpen((v) => !v)}
                  disabled={disabled}
                >
                  {"⋯"}
                </IconButton>

                {menuOpen ? (
                  <Menu panelRef={panelRef} width="lg">
                    <div className="px-4 py-2 text-xs text-fg-muted">
                      {b.consoleId === "3ds"
                        ? "Remove a 3DS system folder (will probably break it)"
                        : "Remove a specific BIOS file"}
                    </div>

                    <MenuSeparator />

                    {menuFiles.map((fileName) => (
                      <MenuItem
                        key={fileName}
                        disabled={disabled}
                        title="Deletes from cache and firmware folder"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(fileName);
                        }}
                      >
                        Delete {fileName}
                      </MenuItem>
                    ))}
                  </Menu>
                ) : null}
              </div>
            ) : null
          ) : (
            <Button size="sm" uppercase disabled>
              Installed
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
