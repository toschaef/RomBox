import { useMemo } from "react";
import type { ControlsProfile, DigitalBinding, DpadBinding, StickBinding } from "../../../shared/types/controls";
import type { BindPlan } from "./model/bindMachine";
import { SECTION_ORDER, STANDARD_LAYOUT, DIR_ICONS, LEFT_STICK_SWITCH_ICONS, RIGHT_STICK_SWITCH_ICONS } from "./model/standardLayout";
import GroupBindingCard from "./GroupBindingCard";
import DigitalBindingCard from "./DigitalBindingCard";
import { getDigital, clearDigital, setGroupMode, clearGroup, type DigitalPath } from "./model/profilePath";

export default function StandardControlsView(props: {
  profile: ControlsProfile;
  playerKey: "player1" | "player2" | "player3" | "player4";
  saveProfile: (p: ControlsProfile) => void;
  bindStateActive: boolean;
  startBind: (plan: BindPlan, playerKey: "player1" | "player2" | "player3" | "player4") => void;
  planEquals: (plan: BindPlan) => boolean;
  isDigitalPressed: (token: DigitalBinding) => boolean;
  isDpadPressed: (dpad: DpadBinding) => boolean;
  isStickPressed: (stick: StickBinding) => boolean;
}) {
  const {
    profile,
    playerKey,
    saveProfile,
    bindStateActive,
    startBind,
    planEquals,
    isDigitalPressed,
    isDpadPressed,
    isStickPressed,
  } = props;

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
          const v = profile[playerKey]?.move ?? { type: "dpad" };
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key} className="mb-4">
              <GroupBindingCard
                title="Move"
                value={v}
                listening={
                  planEquals({ kind: "dpad", group: "move" }) ||
                  planEquals({ kind: "stick", group: "move", stick: "left" })
                }
                active={active}
                isPressed={isDigitalPressed}
                onSetMode={(mode) => void saveProfile(setGroupMode(profile, playerKey, "move", mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: "move" }, playerKey)}
                onBindStick={() => startBind({ kind: "stick", group: "move", stick: "left" }, playerKey)}
                onClear={() => void saveProfile(clearGroup(profile, playerKey, "move"))}
                dirIcons={LEFT_STICK_SWITCH_ICONS}
              />
            </div>
          );
        }

        if (sec.key === "dpad") {
          const v = profile[playerKey]?.dpad ?? { type: "dpad" };
          const active = isDpadPressed(v);

          return (
            <div key={sec.key} className="mb-4">
              <GroupBindingCard
                title="D-Pad"
                value={v}
                listening={planEquals({ kind: "dpad", group: "dpad" })}
                active={active}
                isPressed={isDigitalPressed}
                onSetMode={() => void 0}
                onBindDpad={() => startBind({ kind: "dpad", group: "dpad" }, playerKey)}
                onBindStick={() => void 0}
                onClear={() => void saveProfile(clearGroup(profile, playerKey, "dpad"))}
                dirIcons={DIR_ICONS}
              />
            </div>
          );
        }

        if (sec.key === "rightStick") {
          const v = profile[playerKey]?.look ?? { type: "dpad" };
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key} className="mb-4">
              <GroupBindingCard
                title="Look"
                value={v}
                listening={
                  planEquals({ kind: "dpad", group: "look" }) ||
                  planEquals({ kind: "stick", group: "look", stick: "right" })
                }
                active={active}
                isPressed={isDigitalPressed}
                onSetMode={(mode) => void saveProfile(setGroupMode(profile, playerKey, "look", mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: "look" }, playerKey)}
                onBindStick={() => startBind({ kind: "stick", group: "look", stick: "right" }, playerKey)}
                onClear={() => void saveProfile(clearGroup(profile, playerKey, "look"))}
                dirIcons={RIGHT_STICK_SWITCH_ICONS}
              />
            </div>
          );
        }

        return (
          <div key={sec.key} className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {items
                .filter((x) => x.kind === "digital")
                .map((item) => {
                  const path = item.id as DigitalPath;
                  const binding = getDigital(profile, playerKey, path);
                  const isPressed = binding ? isDigitalPressed(binding) : false;
                  const listening = bindStateActive && planEquals({ kind: "digital", path });

                  return (
                    <DigitalBindingCard
                      key={item.id}
                      title={item.label}
                      iconSrc={item.icon}
                      binding={binding}
                      isActive={isPressed}
                      isListening={listening}
                      onBind={() => startBind({ kind: "digital", path }, playerKey)}
                      onClear={() => {
                        saveProfile(clearDigital(profile, playerKey, path));
                      }}
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
