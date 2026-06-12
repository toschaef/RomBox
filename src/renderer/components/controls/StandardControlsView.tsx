import { useMemo } from "react";
import type { ControlsProfile, DigitalBinding, DpadBinding, StickBinding } from "../../../shared/types/controls";
import type { BindPlan } from "../../controls/bindMachine";
import { SECTION_ORDER, STANDARD_LAYOUT } from "../../controls/layout";
import GroupBindingCard from "./GroupBindingCard";
import DigitalBindingCard from "./DigitalBindingCard";
import { getDigital, clearDigital, setGroupMode, clearGroup, type DigitalPath } from "./controlsUtils";

interface StandardControlsViewProps {
  profile: ControlsProfile;
  saveProfile: (p: ControlsProfile) => void;

  bindStateActive: boolean;
  startBind: (plan: BindPlan) => void;
  planEquals: (p: BindPlan) => boolean;

  isDigitalPressed: (d?: DigitalBinding) => boolean;
  isDpadPressed: (d: DpadBinding) => boolean;
  isStickPressed: (s: StickBinding) => boolean;
}

export default function StandardControlsView(props: StandardControlsViewProps) {
  const { profile, saveProfile, bindStateActive, startBind, planEquals, isDigitalPressed, isDpadPressed, isStickPressed } =
    props;

  const sectionItems = useMemo(() => {
    const map = new Map<string, Array<typeof STANDARD_LAYOUT[number]>>();
    for (const s of SECTION_ORDER) map.set(s.key, []);
    for (const item of STANDARD_LAYOUT) {
      const list = map.get(item.section);
      if (list) list.push(item);
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
                value={v}
                listening={
                  planEquals({ kind: "dpad", group: "move" }) ||
                  planEquals({ kind: "stick", group: "move", stick: "left" })
                }
                active={active}
                isPressed={isDigitalPressed}
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
                isPressed={isDigitalPressed}
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
                value={v}
                listening={
                  planEquals({ kind: "dpad", group: "look" }) ||
                  planEquals({ kind: "stick", group: "look", stick: "right" })
                }
                active={active}
                isPressed={isDigitalPressed}
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
                .map((item) => {
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
