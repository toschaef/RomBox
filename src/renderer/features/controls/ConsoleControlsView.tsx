import { useMemo } from "react";
import type { AnyConsoleLayout, DigitalBinding, DpadBinding, StickBinding } from "../../../shared/types/controls";
import type { BindPlanConsole } from "./model/bindMachine";
import { SECTION_ORDER, LEFT_STICK_SWITCH_ICONS, RIGHT_STICK_SWITCH_ICONS } from "./model/standardLayout";
import { getConsoleLayoutItems, getConsoleDpadIcons } from "./model/consoleLayouts";
import { getPlayerControllerId, getDefaultControllerId } from "../../../shared/controls/controllerModels";
import GroupBindingCard from "./GroupBindingCard";
import DigitalBindingCard from "./DigitalBindingCard";
import {
  getConsoleDigital as getConsoleDigitalById,
  clearConsoleDigital as clearConsoleDigitalById,
  getConsoleGroupValue,
  setConsoleGroupMode,
  clearConsoleGroup,
  type ConsoleGroupId,
} from "./model/consolePath";

export default function ConsoleControlsView(props: {
  layout: AnyConsoleLayout;
  playerKey: "player1" | "player2" | "player3" | "player4";
  saveLayout: (l: AnyConsoleLayout) => void;
  bindStateActive: boolean;
  startBind: (plan: BindPlanConsole, playerKey: "player1" | "player2" | "player3" | "player4") => void;
  planEquals: (plan: BindPlanConsole) => boolean;
  isDigitalPressed: (token: DigitalBinding) => boolean;
  isDpadPressed: (dpad: DpadBinding) => boolean;
  isStickPressed: (stick: StickBinding) => boolean;
}) {
  const {
    layout,
    playerKey,
    saveLayout,
    bindStateActive,
    startBind,
    planEquals,
    isDigitalPressed,
    isDpadPressed,
    isStickPressed,
  } = props;

  const playerControllerId = getPlayerControllerId(layout, playerKey) ?? getDefaultControllerId(layout.consoleId);
  const consoleItems = useMemo(
    () => getConsoleLayoutItems(layout.consoleId, playerControllerId),
    [layout.consoleId, playerControllerId]
  );
  const dpadIcons = useMemo(() => getConsoleDpadIcons(layout.consoleId), [layout.consoleId]);

  const sectionMap = useMemo(() => {
    const map = new Map<string, Array<ReturnType<typeof getConsoleLayoutItems>[number]>>();
    for (const s of SECTION_ORDER) map.set(s.key, []);
    for (const item of consoleItems) {
      const list = map.get(item.section);
      if (list) list.push(item);
    }
    return map;
  }, [consoleItems]);

  return (
    <>
      {SECTION_ORDER.map((sec) => {
        const items = sectionMap.get(sec.key) ?? [];

        if (sec.key === "leftStick") {
          const groupItem = items.find((x) => x.kind === "group" && x.id === "move");
          if (!groupItem) return null;

          const v = getConsoleGroupValue(layout, playerKey, "move");
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key} className="mb-4">
              <GroupBindingCard
                title={groupItem.label ?? "Move"}
                value={v}
                listening={
                  planEquals({ kind: "dpad", group: "move" }) ||
                  planEquals({ kind: "stick", group: "move", stick: "left" })
                }
                active={active}
                isPressed={isDigitalPressed}
                onSetMode={(mode) => void saveLayout(setConsoleGroupMode(layout, playerKey, "move", mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: "move" }, playerKey)}
                onBindStick={() => startBind({ kind: "stick", group: "move", stick: "left" }, playerKey)}
                onClear={() => void saveLayout(clearConsoleGroup(layout, playerKey, "move"))}
                dirIcons={LEFT_STICK_SWITCH_ICONS}
              />
            </div>
          );
        }

        if (sec.key === "dpad") {
          const groupItem = items.find((x) => x.kind === "group" && x.id === "dpad");
          if (!groupItem) return null;

          const v = getConsoleGroupValue(layout, playerKey, "dpad");
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v as DpadBinding);

          return (
            <div key={sec.key} className="mb-4">
              <GroupBindingCard
                title={groupItem.label ?? "D-Pad"}
                value={v}
                listening={planEquals({ kind: "dpad", group: "dpad" })}
                active={active}
                isPressed={isDigitalPressed}
                onSetMode={() => void 0}
                onBindDpad={() => startBind({ kind: "dpad", group: "dpad" }, playerKey)}
                onBindStick={() => void 0}
                onClear={() => void saveLayout(clearConsoleGroup(layout, playerKey, "dpad"))}
                dirIcons={dpadIcons}
              />
            </div>
          );
        }

        if (sec.key === "rightStick") {
          const groupItem = items.find((x) => x.kind === "group" && (x.id === "special.c" || x.id === "look"));
          if (!groupItem) return null;

          const groupId = groupItem.id as ConsoleGroupId;
          const v = getConsoleGroupValue(layout, playerKey, groupId);
          const active = v.type === "stick" ? isStickPressed(v) : isDpadPressed(v);

          return (
            <div key={sec.key} className="mb-4">
              <GroupBindingCard
                title={groupItem.label ?? "C Buttons"}
                value={v}
                listening={
                  planEquals({ kind: "dpad", group: groupId }) ||
                  planEquals({ kind: "stick", group: groupId, stick: "right" })
                }
                active={active}
                isPressed={isDigitalPressed}
                onSetMode={(mode) => void saveLayout(setConsoleGroupMode(layout, playerKey, groupId, mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: groupId }, playerKey)}
                onBindStick={() => startBind({ kind: "stick", group: groupId, stick: "right" }, playerKey)}
                onClear={() => void saveLayout(clearConsoleGroup(layout, playerKey, groupId))}
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
                  const id = item.id as string;
                  const binding = getConsoleDigitalById(layout, playerKey, id);
                  const isPressed = binding ? isDigitalPressed(binding) : false;
                  const listening = bindStateActive && planEquals({ kind: "digital", path: id });

                  return (
                    <DigitalBindingCard
                      key={`${layout.consoleId}:${id}`}
                      title={item.label}
                      iconSrc={item.icon}
                      binding={binding}
                      isActive={isPressed}
                      isListening={listening}
                      onBind={() => startBind({ kind: "digital", path: id }, playerKey)}
                      onClear={() => void saveLayout(clearConsoleDigitalById(layout, playerKey, id))}
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
