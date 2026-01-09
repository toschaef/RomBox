import { useMemo } from "react";

import ControlsHeader from "../controls/ControlsHeader";
import ListeningOverlay from "../controls/ListeningOverlay";
import DigitalBindingCard from "../controls/DigitalBindingCard";
import GroupBindingCard from "../controls/GroupBindingCard";

import { SECTION_ORDER, STANDARD_LAYOUT, type SectionKey } from "../../controls/layout";
import { getConsoleLayoutItems, CONSOLE_OPTIONS } from "../../controls/consoleLayouts";

import { useControlsProfiles, makeClearedProfile, makeResetProfile } from "../../hooks/useControlsProfiles";
import { useControlsLayoutTarget } from "../../hooks/useControlsLayoutTarget";
import { useControlsPressed } from "../../hooks/useControlsPressed";
import { useControlsBinding } from "../../hooks/useControlsBinding";

import type { ConsoleID } from "../../../shared/types";
import type {
  AnyConsoleLayout,
  ControlsProfile,
  DigitalBinding,
  DpadBinding,
  StickBinding,
} from "../../../shared/controls/types";

import {
  getConsoleDigital as getConsoleDigitalById,
  clearConsoleDigital as clearConsoleDigitalById,
} from "../../controls/consolePath";

import type { BindPlan } from "../../controls/bindMachine";
import type { BindPlanConsole } from "../../controls/consoleBindMachine";

type DigitalPath =
  | "face.primary"
  | "face.secondary"
  | "face.tertiary"
  | "face.quaternary"
  | "shoulders.bumperL"
  | "shoulders.bumperR"
  | "shoulders.triggerL"
  | "shoulders.triggerR"
  | "system.start"
  | "system.select";

function getDigital(p: ControlsProfile, path: DigitalPath): DigitalBinding | undefined {
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system", string];
  // @ts-expect-error dynamic keying
  return p.player1[group][key];
}

function clearDigital(p: ControlsProfile, path: DigitalPath): ControlsProfile {
  const next = structuredClone(p);
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system", string];
  // @ts-expect-error dynamic keying
  delete next.player1[group][key];
  return next;
}

function setGroupMode(p: ControlsProfile, group: "move" | "dpad" | "look", mode: "dpad" | "stick"): ControlsProfile {
  const next = structuredClone(p);

  const defaultStick = (stick: "left" | "right"): StickBinding => ({ type: "stick", stick, deadzone: 0.15 });
  const defaultDpad = (): DpadBinding => ({ type: "dpad" });

  if (group === "move") {
    next.player1.move = mode === "dpad" ? defaultDpad() : defaultStick("left");
  } else if (group === "dpad") {
    next.player1.dpad = defaultDpad();
  } else {
    next.player1.look = mode === "dpad" ? defaultDpad() : defaultStick("right");
  }

  return next;
}

function clearGroup(p: ControlsProfile, group: "move" | "dpad" | "look"): ControlsProfile {
  const next = structuredClone(p);

  if (group === "move") {
    next.player1.move =
      next.player1.move.type === "stick"
        ? { type: "stick", stick: next.player1.move.stick, deadzone: next.player1.move.deadzone }
        : { type: "dpad" };
  } else if (group === "dpad") {
    next.player1.dpad = { type: "dpad" };
  } else {
    next.player1.look =
      next.player1.look.type === "stick"
        ? { type: "stick", stick: next.player1.look.stick, deadzone: next.player1.look.deadzone }
        : { type: "dpad" };
  }

  return next;
}

type ConsoleDigitalPath = DigitalPath | "z";
type ConsoleGroupId = "move" | "dpad" | "c";

function defaultStick(stick: "left" | "right"): StickBinding {
  return { type: "stick", stick, deadzone: 0.15 };
}
function defaultDpad(): DpadBinding {
  return { type: "dpad" };
}

function getConsoleDigital(layout: AnyConsoleLayout, path: ConsoleDigitalPath): DigitalBinding | undefined {
  const b: any = (layout as any).bindings ?? {};
  if (path === "z") return b.z as DigitalBinding | undefined;

  const [group, key] = path.split(".") as ["face" | "shoulders" | "system", string];
  return b?.[group]?.[key] as DigitalBinding | undefined;
}

function clearConsoleDigital(layout: AnyConsoleLayout, path: ConsoleDigitalPath): AnyConsoleLayout {
  const next = structuredClone(layout) as any;
  next.bindings ??= {};

  if (path === "z") {
    delete next.bindings.z;
    return next as AnyConsoleLayout;
  }

  const [group, key] = path.split(".") as ["face" | "shoulders" | "system", string];
  next.bindings[group] ??= {};
  delete next.bindings[group][key];
  return next as AnyConsoleLayout;
}

function getConsoleGroupValue(layout: AnyConsoleLayout, group: ConsoleGroupId): DpadBinding | StickBinding {
  const b: any = (layout as any).bindings ?? {};
  const v = b?.[group];

  if (v && (v.type === "dpad" || v.type === "stick")) return v as DpadBinding | StickBinding;

  if (group === "move") return defaultDpad();
  if (group === "dpad") return defaultDpad();
  return defaultDpad();
}

function setConsoleGroupMode(layout: AnyConsoleLayout, group: ConsoleGroupId, mode: "dpad" | "stick"): AnyConsoleLayout {
  const next = structuredClone(layout) as any;
  next.bindings ??= {};

  if (mode === "dpad") {
    next.bindings[group] = defaultDpad();
    return next as AnyConsoleLayout;
  }

  const stick: "left" | "right" = group === "c" ? "right" : "left";
  next.bindings[group] = defaultStick(stick);
  return next as AnyConsoleLayout;
}

function clearConsoleGroup(layout: AnyConsoleLayout, group: ConsoleGroupId): AnyConsoleLayout {
  const next = structuredClone(layout) as any;
  next.bindings ??= {};

  const current = next.bindings[group];
  if (current?.type === "stick") {
    next.bindings[group] = { type: "stick", stick: current.stick, deadzone: current.deadzone };
  } else {
    next.bindings[group] = { type: "dpad" };
  }

  return next as AnyConsoleLayout;
}

function StandardControlsView(props: {
  profile: ControlsProfile;
  saveProfile: (p: ControlsProfile) => void;

  bindStateActive: boolean;
  startBind: (plan: BindPlan) => void;
  planEquals: (p: BindPlan) => boolean;

  isDigitalPressed: (d?: DigitalBinding) => boolean;
  isDpadPressed: (d: DpadBinding) => boolean;
  isStickPressed: (s: StickBinding) => boolean;
}) {
  const { profile, saveProfile, bindStateActive, startBind, planEquals, isDigitalPressed, isDpadPressed, isStickPressed } =
    props;

  const sectionItems = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of SECTION_ORDER) map.set(s.key, []);
    for (const item of STANDARD_LAYOUT) {
      const list = map.get(item.section);
      if (list) list.push(item as any);
    }
    return map;
  }, []);

  return (
    <>
      {SECTION_ORDER.map((sec) => {
        const items = sectionItems.get(sec.key) ?? [];

        if (sec.key === "leftStick") {
          const v = profile.player1.move;
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key}>
              <GroupBindingCard
                title="Move"
                value={v as any}
                listening={
                  planEquals({ kind: "dpad", group: "move" }) ||
                  planEquals({ kind: "stick", group: "move", stick: "left" })
                }
                active={active}
                onSetMode={(mode) => void saveProfile(setGroupMode(profile, "move", mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: "move" })}
                onBindStick={() => startBind({ kind: "stick", group: "move", stick: "left" })}
                onClear={() => void saveProfile(clearGroup(profile, "move"))}
                hint={v.type === "stick" ? "Binds X then Y" : "Binds Up, Down, Left, Right"}
              />
            </div>
          );
        }

        if (sec.key === "dpad") {
          const v = profile.player1.dpad;
          const active = isDpadPressed(v);

          return (
            <div key={sec.key}>
              <GroupBindingCard
                title="D-Pad"
                value={v}
                listening={planEquals({ kind: "dpad", group: "dpad" })}
                active={active}
                onSetMode={() => void 0}
                onBindDpad={() => startBind({ kind: "dpad", group: "dpad" })}
                onBindStick={() => void 0}
                onClear={() => void saveProfile(clearGroup(profile, "dpad"))}
                hint="Binds Up, Down, Left, Right"
              />
            </div>
          );
        }

        if (sec.key === "rightStick") {
          const v = profile.player1.look;
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key}>
              <GroupBindingCard
                title="Look"
                value={v as any}
                listening={
                  planEquals({ kind: "dpad", group: "look" }) ||
                  planEquals({ kind: "stick", group: "look", stick: "right" })
                }
                active={active}
                onSetMode={(mode) => void saveProfile(setGroupMode(profile, "look", mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: "look" })}
                onBindStick={() => startBind({ kind: "stick", group: "look", stick: "right" })}
                onClear={() => void saveProfile(clearGroup(profile, "look"))}
                hint={v.type === "stick" ? "Binds X then Y" : "Binds Up, Down, Left, Right"}
              />
            </div>
          );
        }

        return (
          <div key={sec.key} className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {items
                .filter((x: any) => x.kind === "digital")
                .map((item: any) => {
                  const path = item.id as DigitalPath;
                  const binding = getDigital(profile, path);
                  const active = isDigitalPressed(binding);
                  const listening = bindStateActive && planEquals({ kind: "digital", path });

                  return (
                    <DigitalBindingCard
                      key={item.id}
                      title={item.label}
                      iconSrc={item.icon}
                      binding={binding}
                      isActive={active}
                      isListening={listening}
                      onBind={() => startBind({ kind: "digital", path })}
                      onClear={() => void saveProfile(clearDigital(profile, path))}
                    />
                  );
                })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function ConsoleControlsView(props: {
  layout: AnyConsoleLayout;
  saveLayout: (l: AnyConsoleLayout) => void;

  bindStateActive: boolean;
  startBind: (plan: BindPlanConsole) => void;
  planEquals: (p: BindPlanConsole) => boolean;

  isDigitalPressed: (d?: DigitalBinding) => boolean;
  isDpadPressed: (d: DpadBinding) => boolean;
  isStickPressed: (s: StickBinding) => boolean;
}) {
  const { layout, saveLayout, bindStateActive, startBind, planEquals, isDigitalPressed, isDpadPressed, isStickPressed } =
    props;

  const consoleItems = useMemo(() => getConsoleLayoutItems(layout.consoleId), [layout.consoleId]);

  const sectionMap = useMemo(() => {
    const map = new Map<SectionKey, any[]>();
    for (const s of SECTION_ORDER) map.set(s.key, []);
    for (const item of consoleItems) {
      const list = map.get(item.section);
      if (list) list.push(item as any);
    }
    return map;
  }, [consoleItems]);

  return (
    <>
      {SECTION_ORDER.map((sec) => {
        const items = sectionMap.get(sec.key) ?? [];

        if (sec.key === "leftStick") {
          const groupItem = items.find((x: any) => x.kind === "group" && x.id === "move");
          if (!groupItem) return null;

          const v = getConsoleGroupValue(layout, "move");
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key}>
              <GroupBindingCard
                title={groupItem.label ?? "Move"}
                value={v as any}
                listening={
                  planEquals({ kind: "dpad", group: "move" } as any) ||
                  planEquals({ kind: "stick", group: "move", stick: "left" } as any)
                }
                active={active}
                onSetMode={(mode) => void saveLayout(setConsoleGroupMode(layout, "move", mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: "move" } as any)}
                onBindStick={() => startBind({ kind: "stick", group: "move", stick: "left" } as any)}
                onClear={() => void saveLayout(clearConsoleGroup(layout, "move"))}
                hint={v.type === "stick" ? "Binds X then Y" : "Binds Up, Down, Left, Right"}
              />
            </div>
          );
        }

        if (sec.key === "dpad") {
          const groupItem = items.find((x: any) => x.kind === "group" && x.id === "dpad");
          if (!groupItem) return null;

          const v = getConsoleGroupValue(layout, "dpad");
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v as DpadBinding);

          return (
            <div key={sec.key}>
              <GroupBindingCard
                title={groupItem.label ?? "D-Pad"}
                value={v as any}
                listening={planEquals({ kind: "dpad", group: "dpad" } as any)}
                active={active}
                onSetMode={() => void 0}
                onBindDpad={() => startBind({ kind: "dpad", group: "dpad" } as any)}
                onBindStick={() => void 0}
                onClear={() => void saveLayout(clearConsoleGroup(layout, "dpad"))}
                hint="Binds Up, Down, Left, Right"
              />
            </div>
          );
        }

        if (sec.key === "rightStick") {
          const groupItem = items.find((x: any) => x.kind === "group" && x.id === "c");
          if (!groupItem) return null;

          const v = getConsoleGroupValue(layout, "c");
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key}>
              <GroupBindingCard
                title={groupItem.label ?? "C Buttons"}
                value={v as any}
                listening={
                  planEquals({ kind: "dpad", group: "c" } as any) ||
                  planEquals({ kind: "stick", group: "c", stick: "right" } as any)
                }
                active={active}
                onSetMode={(mode) => void saveLayout(setConsoleGroupMode(layout, "c", mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: "c" } as any)}
                onBindStick={() => startBind({ kind: "stick", group: "c", stick: "right" } as any)}
                onClear={() => void saveLayout(clearConsoleGroup(layout, "c"))}
                hint={v.type === "stick" ? "Binds X then Y" : "Binds Up, Down, Left, Right"}
              />
            </div>
          );
        }

        return (
          <div key={sec.key} className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {items
                .filter((x: any) => x.kind === "digital")
                .map((item: any) => {
                  const id = item.id as string;
                  const binding = getConsoleDigitalById(layout, id);
                  const active = isDigitalPressed(binding);
                  const listening = bindStateActive && planEquals({ kind: "digital", path: id } as any);

                  return (
                    <DigitalBindingCard
                      key={`${layout.consoleId}:${id}`}
                      title={item.label}
                      iconSrc={item.icon}
                      binding={binding}
                      isActive={active}
                      isListening={listening}
                      onBind={() => startBind({ kind: "digital", path: id } as any)}
                      onClear={() => void saveLayout(clearConsoleDigitalById(layout, id))}
                    />
                  );
                })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function Controls() {
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

  const mode =
    layoutApi.isConsoleMode && layoutApi.consoleLayout
      ? ({
          kind: "console" as const,
          layout: layoutApi.consoleLayout,
          onChange: (l: AnyConsoleLayout): void => {
            void layoutApi.saveConsoleLayout(l);
          },
        })
      : profile
        ? ({
            kind: "standard" as const,
            profile,
            onChange: (p: ControlsProfile): void => {
              void saveProfile(p);
            },
          })
        : null;

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
    <div className="h-full w-full p-4 overflow-y-auto">
      <ControlsHeader
        profiles={profiles as any}
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

      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="text-xs uppercase tracking-widest font-bold text-fg-muted">Layout</div>

          <div className="flex bg-bg-secondary rounded-lg p-1 border border-border-subtle">
            <button
              type="button"
              onClick={() => {
                cancelBind();
                layoutApi.setStandard();
              }}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
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
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                layoutApi.isConsoleMode
                  ? "bg-accent-secondary text-white"
                  : "text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted"
              }`}
            >
              Console
            </button>
          </div>

          {layoutApi.isConsoleMode ? (
            <select
              value={layoutApi.consoleId ?? "nes"}
              onChange={(e) => {
                cancelBind();
                layoutApi.setConsole(e.target.value as ConsoleID);
              }}
              className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg bg-bg-secondary text-fg-primary border border-border-subtle hover:border-border-muted transition-colors"
            >
              {CONSOLE_OPTIONS.map((c) => (
                <option key={c.id} value={c.id} className="bg-bg-secondary text-fg-primary">
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {bindStateActive ? <ListeningOverlay listeningFor={overlayLabel} guided={false} /> : null}

      {layoutApi.isConsoleMode ? (
        layoutApi.consoleLayout ? (
          <ConsoleControlsView
            layout={layoutApi.consoleLayout}
            saveLayout={(l) => void layoutApi.saveConsoleLayout(l)}
            bindStateActive={bindStateActive}
            startBind={(p) => startBind(p as any)}
            planEquals={(p) => planEqualsConsole(p as any)}
            isDigitalPressed={isDigitalPressed}
            isDpadPressed={isDpadPressed}
            isStickPressed={isStickPressed}
          />
        ) : (
          <div className="px-4 text-fg-muted">Loading console layout</div>
        )
      ) : (
        <StandardControlsView
          profile={profile}
          saveProfile={(p) => void saveProfile(p)}
          bindStateActive={bindStateActive}
          startBind={(p) => startBind(p as any)}
          planEquals={planEqualsStd}
          isDigitalPressed={isDigitalPressed}
          isDpadPressed={isDpadPressed}
          isStickPressed={isStickPressed}
        />
      )}
    </div>
  );
}