import { useMemo, useState, useEffect } from "react";
import ControlsHeader from "../controls/ControlsHeader";
import ListeningOverlay from "../controls/ListeningOverlay";
import PageLayout from "../layout/PageLayout";
import { CONSOLE_OPTIONS } from "../../controls/consoleLayouts";
import { useControlsProfiles, makeClearedProfile, makeResetProfile } from "../../hooks/useControlsProfiles";
import { useControlsLayoutTarget } from "../../hooks/useControlsLayoutTarget";
import { useControlsPressed } from "../../hooks/useControlsPressed";
import { useControlsBinding } from "../../hooks/useControlsBinding";
import type { ConsoleID } from "../../../shared/types";
import type { AnyConsoleLayout, ControlsProfile } from "../../../shared/types/controls";
import type { BindPlan, BindPlanConsole } from "../../controls/bindMachine";
import StandardControlsView from "../controls/StandardControlsView";
import ConsoleControlsView from "../controls/ConsoleControlsView";
import { getSupportedControllers, getDefaultControllerId } from "../../../shared/controls/controllerModels";

export default function Controls() {
  const [activePlayer, setActivePlayer] = useState<"player1" | "player2" | "player3" | "player4">("player1");

  const {
    profiles,
    activeProfileId,
    profile,
    saving,
    changeProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    setAsDefault,
    saveProfile,
  } = useControlsProfiles();

  const layoutApi = useControlsLayoutTarget({
    profile,
    profileId: activeProfileId,
  });

  const mode = useMemo(() => {
    if (layoutApi.isConsoleMode && layoutApi.consoleLayout) {
      return {
        kind: "console" as const,
        layout: layoutApi.consoleLayout,
        onChange: (l: AnyConsoleLayout): void => {
          void layoutApi.saveConsoleLayout(l);
        },
      };
    }
    if (profile) {
      return {
        kind: "standard" as const,
        profile,
        onChange: (p: ControlsProfile): void => {
          void saveProfile(p);
        },
      };
    }
    return null;
  }, [layoutApi.isConsoleMode, layoutApi.consoleLayout, layoutApi.saveConsoleLayout, profile, saveProfile]);

  const fallbackMode = useMemo(() => {
    const noop = (): void => void 0;
    return {
      kind: "standard" as const,
      profile: (profile ?? ({} as ControlsProfile)),
      onChange: noop,
    };
  }, [profile]);

  const { bindStateActive, overlayLabel, currentlyPressed, startBind, cancelBind, stdState, consoleState } =
    useControlsBinding(mode ?? fallbackMode);

  const { isDigitalPressed, isDpadPressed, isStickPressed } = useControlsPressed(currentlyPressed);

  const isHandheld = layoutApi.isConsoleMode && ["gb", "gba", "gg", "ds", "3ds"].includes(layoutApi.consoleId ?? "");
  
  useEffect(() => {
    if (isHandheld && activePlayer !== "player1") {
      setActivePlayer("player1");
    }
  }, [isHandheld, activePlayer]);

  if (!profile || !activeProfileId) {
    return <div className="h-full w-full p-8 text-fg-muted">Loading...</div>;
  }

  const planEqualsStd = (p: BindPlan): boolean => {
    if (!stdState.active) return false;
    return JSON.stringify(stdState.plan) === JSON.stringify(p);
  };

  const planEqualsConsole = (p: BindPlanConsole): boolean => {
    if (!consoleState.active) return false;
    return JSON.stringify(consoleState.plan) === JSON.stringify(p);
  };

  return (
    <PageLayout
      title="Controls"
      actions={
        <ControlsHeader
          profiles={profiles}
          activeProfileId={activeProfileId}
          saving={saving || layoutApi.layoutSaving}
          onChangeProfile={(id) => {
            cancelBind();
            void (async () => {
              await setAsDefault(id);
              await changeProfile(id);
            })();
          }}
          onCreateProfile={(name) => void createProfile(name)}
          onRenameProfile={(id, name) => void renameProfile(id, name)}
          onDeleteProfile={(id) => void deleteProfile(id)}
          onSetDefault={() => void 0}
          onClear={() => {
            cancelBind();
            if (layoutApi.isConsoleMode && layoutApi.consoleId) {
              void layoutApi.resetConsoleLayout(layoutApi.consoleId);
            } else {
              void saveProfile(makeClearedProfile(profile));
            }
          }}
          onReset={() => {
            cancelBind();
            if (layoutApi.isConsoleMode && layoutApi.consoleId) {
              void layoutApi.resetConsoleLayout(layoutApi.consoleId);
            } else {
              void saveProfile(makeResetProfile(profile));
            }
          }}
        />
      }
    >
      <div className="pb-8">
        <div className="flex flex-wrap gap-4 items-center mb-8 pb-4 border-b border-border-subtle">
          <div className="text-xs uppercase tracking-widest font-bold text-fg-muted">Input Layout</div>

          <div className="flex border border-border-subtle bg-bg-secondary">
            <button
              type="button"
              onClick={() => {
                cancelBind();
                layoutApi.setStandard();
              }}
              className={`px-3 py-1.5 text-xs font-bold transition-colors border-r border-border-subtle ${
                layoutApi.isConsoleMode
                  ? "text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted"
                  : "bg-accent-secondary text-white"
              }`}
            >
              Standard
            </button>

            <button
              type="button"
              onClick={() => {
                cancelBind();
                const first = CONSOLE_OPTIONS[0]?.id ?? ("nes" as ConsoleID);
                layoutApi.setConsole(layoutApi.consoleId ?? first);
              }}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                layoutApi.isConsoleMode
                  ? "bg-accent-secondary text-white"
                  : "text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted"
              }`}
            >
              Console
            </button>
          </div>

          {!isHandheld ? (
            <div className="flex border border-border-subtle bg-bg-secondary ml-4">
              {(["player1", "player2", "player3", "player4"] as const).map((pk, idx) => (
                <button
                  key={pk}
                  type="button"
                  onClick={() => {
                    cancelBind();
                    setActivePlayer(pk);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    idx < 3 ? "border-r border-border-subtle" : ""
                  } ${
                    activePlayer === pk
                      ? "bg-accent-secondary text-white"
                      : "text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted"
                  }`}
                >
                  P{idx + 1}
                </button>
              ))}
            </div>
          ) : null}

          {layoutApi.isConsoleMode ? (
            <div className="relative">
              <select
                value={layoutApi.consoleId ?? "nes"}
                onChange={(e) => {
                  cancelBind();
                  layoutApi.setConsole(e.target.value as ConsoleID);
                  e.target.blur();
                }}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold bg-bg-secondary text-fg-primary border border-border-subtle hover:border-border-muted transition-colors rounded-none focus:outline-none focus:border-accent-primary"
              >
                {CONSOLE_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id} className="bg-bg-secondary text-fg-primary">
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-fg-secondary">
                ▼
              </div>
            </div>
          ) : null}

          {layoutApi.isConsoleMode && layoutApi.consoleId && getSupportedControllers(layoutApi.consoleId).length > 1 ? (
            <div className="relative">
              <select
                value={layoutApi.consoleLayout?.controllerId ?? getDefaultControllerId(layoutApi.consoleId)}
                onChange={(e) => {
                  cancelBind();
                  if (layoutApi.consoleLayout) {
                    layoutApi.saveConsoleLayout({
                      ...layoutApi.consoleLayout,
                      controllerId: e.target.value
                    });
                  }
                  e.target.blur();
                }}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold bg-bg-secondary text-fg-primary border border-border-subtle hover:border-border-muted transition-colors rounded-none focus:outline-none focus:border-accent-primary"
              >
                {getSupportedControllers(layoutApi.consoleId).map((c) => (
                  <option key={c.id} value={c.id} className="bg-bg-secondary text-fg-primary">
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-fg-secondary">
                ▼
              </div>
            </div>
          ) : null}
        </div>

        {bindStateActive ? <ListeningOverlay listeningFor={overlayLabel} guided={false} /> : null}

        {layoutApi.isConsoleMode ? (
          layoutApi.consoleLayout ? (
            <ConsoleControlsView
              layout={layoutApi.consoleLayout}
              playerKey={activePlayer}
              saveLayout={(l) => void layoutApi.saveConsoleLayout(l)}
              bindStateActive={bindStateActive}
              startBind={(p) => startBind(p, activePlayer)}
              planEquals={(p) => planEqualsConsole(p)}
              isDigitalPressed={isDigitalPressed}
              isDpadPressed={isDpadPressed}
              isStickPressed={isStickPressed}
            />
          ) : null
        ) : (
          <StandardControlsView
            profile={profile}
            playerKey={activePlayer}
            saveProfile={(p) => void saveProfile(p)}
            bindStateActive={bindStateActive}
            startBind={(p) => startBind(p, activePlayer)}
            planEquals={planEqualsStd}
            isDigitalPressed={isDigitalPressed}
            isDpadPressed={isDpadPressed}
            isStickPressed={isStickPressed}
          />
        )}
      </div>
    </PageLayout>
  );
}