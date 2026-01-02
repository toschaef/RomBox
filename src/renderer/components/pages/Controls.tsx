import { useMemo } from "react";
import ControlsHeader from "../controls/ControlsHeader";
import ListeningOverlay from "../controls/ListeningOverlay";
import DigitalBindingCard from "../controls/DigitalBindingCard";
import GroupBindingCard from "../controls/GroupBindingCard";

import { SECTION_ORDER, STANDARD_LAYOUT } from "../../controls/layout";
import { useControlsProfiles, makeClearedProfile, makeResetProfile } from "../../hooks/useControlsProfiles";
import { useControlsBinding } from "../../hooks/useControlsBinding";
import { useControlsPressed } from "../../hooks/useControlsPressed";

import type { ControlsProfile, DigitalBinding, DpadBinding, StickBinding } from "../../../shared/controls/types";
import type { BindPlan } from "../../controls/bindMachine";

type DigitalPath =
  | "face.primary" | "face.secondary" | "face.tertiary" | "face.quaternary"
  | "shoulders.bumperL" | "shoulders.bumperR" | "shoulders.triggerL" | "shoulders.triggerR"
  | "system.start" | "system.select";

function getDigital(p: ControlsProfile, path: DigitalPath): DigitalBinding | undefined {
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system", string];
  // @ts-expect-error todo: fix
  return p.player1[group][key];
}

function clearDigital(p: ControlsProfile, path: DigitalPath): ControlsProfile {
  const next = structuredClone(p);
  const [group, key] = path.split(".") as ["face" | "shoulders" | "system", string];
  // @ts-expect-error todo: fix
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
    next.player1.move = next.player1.move.type === "stick"
      ? { type: "stick", stick: next.player1.move.stick, deadzone: next.player1.move.deadzone }
      : { type: "dpad" };
  } else if (group === "dpad") {
    next.player1.dpad = { type: "dpad" };
  } else {
    next.player1.look = next.player1.look.type === "stick"
      ? { type: "stick", stick: next.player1.look.stick, deadzone: next.player1.look.deadzone }
      : { type: "dpad" };
  }

  return next;
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

  const { bindState, overlayLabel, currentlyPressed, startBind, cancelBind } = useControlsBinding({
    profile,
    onProfileChange: (p) => void saveProfile(p),
  });

  const { isDigitalPressed, isDpadPressed, isStickPressed } = useControlsPressed(currentlyPressed);

  const sectionItems = useMemo(() => {
    const map = new Map<string, typeof STANDARD_LAYOUT>();
    for (const s of SECTION_ORDER) map.set(s.key, []);
    for (const item of STANDARD_LAYOUT) {
      const list = map.get(item.section);
      if (list) list.push(item as any);
    }
    return map;
  }, []);

  if (!profile || !activeProfileId) {
    return <div className="h-full w-full p-8 text-fg-muted">Loading...</div>;
  }

  const isListening = bindState.active;

  const planEquals = (p: BindPlan) => {
    if (!bindState.active) return false;
    return JSON.stringify(bindState.plan) === JSON.stringify(p);
  };

  return (
    <div className="h-full w-full p-4 overflow-y-auto">
      <ControlsHeader
        profiles={profiles}
        activeProfileId={activeProfileId}
        saving={saving}
        onChangeProfile={(id) => {
          cancelBind();
          void changeProfile(id);
        }}
        onCreateProfile={(name) => void createProfile(name)}
        onRenameProfile={(id, name) => void renameProfile(id, name)}
        onDeleteProfile={(id) => void deleteProfile(id)}
        onSetDefault={(id) => void setAsDefault(id)}
        onClear={() => {
          cancelBind();
          void saveProfile(makeClearedProfile(profile));
        }}
        onReset={() => {
          cancelBind();
          void saveProfile(makeResetProfile(profile));
        }}
      />

      {bindState.active ? (
        <ListeningOverlay listeningFor={overlayLabel} guided={false} />
      ) : null}

      {SECTION_ORDER.map((sec) => {
        const items = sectionItems.get(sec.key) ?? [];

        if (sec.key === "leftStick") {
          const v = profile.player1.move;
          const active =
            v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key}>
              <GroupBindingCard
                title="Move"
                value={v as any}
                listening={planEquals({ kind: "dpad", group: "move" }) || planEquals({ kind: "stick", group: "move", stick: "left" })}
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
                listening={planEquals({ kind: "dpad", group: "look" }) || planEquals({ kind: "stick", group: "look", stick: "right" })}
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
                .filter((x) => x.kind === "digital")
                .map((item: any) => {
                  const path = item.id as DigitalPath;
                  const binding = getDigital(profile, path);
                  const active = isDigitalPressed(binding);
                  const listening = bindState.active && planEquals({ kind: "digital", path });

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
    </div>
  );
}