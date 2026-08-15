import { useMemo, useState, useEffect } from "react";
import ControlsHeader from "./ControlsHeader";
import ListeningOverlay from "./ListeningOverlay";
import { PageLayout, Segment, SegmentedControl, Select } from "../../ui";
import { CONSOLE_OPTIONS } from "./model/consoleLayouts";
import { useControlsProfiles, makeClearedProfile, makeResetProfile } from "./hooks/useControlsProfiles";
import { useControlsLayoutTarget } from "./hooks/useControlsLayoutTarget";
import { useControlsPressed } from "./hooks/useControlsPressed";
import { useControlsBinding } from "./hooks/useControlsBinding";
import { usePlayerTabDrag } from "./hooks/usePlayerTabDrag";
import type { ConsoleID } from "../../../shared/types";
import type { AnyConsoleLayout, ControlsProfile, PlayerKey } from "../../../shared/types/controls";
import StandardControlsView from "./StandardControlsView";
import ConsoleControlsView from "./ConsoleControlsView";
import {
  getSupportedControllers,
  getDefaultControllerId,
  getPlayerControllerId,
  withPlayerControllerId,
} from "../../../shared/controls/controllerModels";
import { PLAYER_KEYS, movePlayerSlot, reorderProfilePlayers, reorderConsoleLayoutPlayers } from "./model/reorderPlayers";

const HANDHELD_CONSOLES = ["gb", "gba", "gg", "ds", "3ds"];

const LAYOUT_MODES = [
  { value: "standard" as const, label: "Standard" },
  { value: "console" as const, label: "Console" },
];

export default function Controls() {
  const [activePlayer, setActivePlayer] = useState<PlayerKey>("player1");

  // while true the page ignores keyboard/gamepad input instead of binding it
  const [inputPaused, setInputPaused] = useState(false);

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

  const layoutApi = useControlsLayoutTarget({ profile, profileId: activeProfileId });

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

  const fallbackMode = useMemo(
    () => ({ kind: "standard" as const, profile: profile ?? ({} as ControlsProfile), onChange: (): void => void 0 }),
    [profile]
  );

  const { bindStateActive, overlayLabel, currentlyPressed, startBind, cancelBind, planEquals } =
    useControlsBinding(mode ?? fallbackMode, { inputPaused });

  const { isDigitalPressed, isDpadPressed, isStickPressed } = useControlsPressed(currentlyPressed);

  const isHandheld = layoutApi.isConsoleMode && HANDHELD_CONSOLES.includes(layoutApi.consoleId ?? "");

  useEffect(() => {
    if (isHandheld && activePlayer !== "player1") {
      setActivePlayer("player1");
    }
  }, [isHandheld, activePlayer]);

  const commitPlayerReorder = (sourceIndex: number, targetIndex: number): void => {
    if (sourceIndex === targetIndex) return;

    cancelBind();
    const order = movePlayerSlot(sourceIndex, targetIndex);
    if (layoutApi.isConsoleMode && layoutApi.consoleLayout) {
      void layoutApi.saveConsoleLayout(
        reorderConsoleLayoutPlayers(layoutApi.consoleLayout, order, profile ?? undefined)
      );
    } else if (profile) {
      void saveProfile(reorderProfilePlayers(profile, order));
    }
    setActivePlayer(PLAYER_KEYS[targetIndex] as PlayerKey);
  };

  const { containerRef, tabProps } = usePlayerTabDrag({
    onReorder: commitPlayerReorder,
    onSelect: (idx) => {
      cancelBind();
      setActivePlayer(PLAYER_KEYS[idx] as PlayerKey);
    },
  });

  if (!profile || !activeProfileId) {
    return <div className="h-full w-full p-8 text-fg-muted">Loading...</div>;
  }

  const controllerOptions = layoutApi.consoleId ? getSupportedControllers(layoutApi.consoleId) : [];

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
          onEditingChange={setInputPaused}
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

          <SegmentedControl
            options={LAYOUT_MODES}
            value={layoutApi.isConsoleMode ? "console" : "standard"}
            onChange={(next) => {
              cancelBind();
              if (next === "standard") layoutApi.setStandard();
              else layoutApi.setConsole(layoutApi.consoleId ?? CONSOLE_OPTIONS[0]?.id ?? ("nes" as ConsoleID));
            }}
          />

          {!isHandheld ? (
            <div ref={containerRef} className="flex border border-border-subtle bg-bg-secondary ml-4">
              {PLAYER_KEYS.map((pk, idx) => (
                <Segment
                  key={pk}
                  selected={activePlayer === pk}
                  divided={idx < PLAYER_KEYS.length - 1}
                  className="relative touch-none cursor-grab active:cursor-grabbing transition-[transform,background-color,color,box-shadow] duration-fast ease-out data-dragging:opacity-90 data-dragging:shadow-menu"
                  {...tabProps(idx)}
                >
                  P{idx + 1}
                </Segment>
              ))}
            </div>
          ) : null}

          {layoutApi.isConsoleMode ? (
            <Select
              data-testid="console-select"
              size="sm"
              blurOnChange
              value={layoutApi.consoleId ?? "nes"}
              options={CONSOLE_OPTIONS.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => {
                cancelBind();
                layoutApi.setConsole(v as ConsoleID);
              }}
            />
          ) : null}

          {layoutApi.isConsoleMode && layoutApi.consoleId && controllerOptions.length > 1 ? (
            <Select
              data-testid="controller-select"
              size="sm"
              blurOnChange
              value={
                (layoutApi.consoleLayout ? getPlayerControllerId(layoutApi.consoleLayout, activePlayer) : undefined) ??
                getDefaultControllerId(layoutApi.consoleId)
              }
              options={controllerOptions.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => {
                cancelBind();
                if (layoutApi.consoleLayout) {
                  void layoutApi.saveConsoleLayout(withPlayerControllerId(layoutApi.consoleLayout, activePlayer, v));
                }
              }}
            />
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
              planEquals={planEquals}
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
            planEquals={planEquals}
            isDigitalPressed={isDigitalPressed}
            isDpadPressed={isDpadPressed}
            isStickPressed={isStickPressed}
          />
        )}
      </div>
    </PageLayout>
  );
}