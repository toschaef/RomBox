import { useMemo } from "react";
import type { AnyConsoleLayout, DigitalBinding, DpadBinding, StickBinding } from "../../../shared/types/controls";
import type { BindPlanConsole } from "../../controls/bindMachine";
import { SECTION_ORDER } from "../../controls/layout";
import { getConsoleLayoutItems, getConsoleDpadIcons } from "../../controls/consoleLayouts";
import GroupBindingCard from "./GroupBindingCard";
import DigitalBindingCard from "./DigitalBindingCard";
import {
  getConsoleDigital as getConsoleDigitalById,
  clearConsoleDigital as clearConsoleDigitalById,
} from "../../controls/consolePath";
import {
  getConsoleGroupValue,
  setConsoleGroupMode,
  clearConsoleGroup,
  type ConsoleGroupId,
} from "./controlsUtils";

interface ConsoleControlsViewProps {
  layout: AnyConsoleLayout;
  saveLayout: (l: AnyConsoleLayout) => void;

  bindStateActive: boolean;
  startBind: (plan: BindPlanConsole) => void;
  planEquals: (p: BindPlanConsole) => boolean;

  isDigitalPressed: (d?: DigitalBinding) => boolean;
  isDpadPressed: (d: DpadBinding) => boolean;
  isStickPressed: (s: StickBinding) => boolean;
}

export default function ConsoleControlsView(props: ConsoleControlsViewProps) {
  const { layout, saveLayout, bindStateActive, startBind, planEquals, isDigitalPressed, isDpadPressed, isStickPressed } =
    props;

  const consoleItems = useMemo(() => getConsoleLayoutItems(layout.consoleId), [layout.consoleId]);
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

          const v = getConsoleGroupValue(layout, "move");
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
                onSetMode={(mode) => void saveLayout(setConsoleGroupMode(layout, "move", mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: "move" })}
                onBindStick={() => startBind({ kind: "stick", group: "move", stick: "left" })}
                onClear={() => void saveLayout(clearConsoleGroup(layout, "move"))}
                dirIcons={dpadIcons}
              />
            </div>
          );
        }

        if (sec.key === "dpad") {
          const groupItem = items.find((x) => x.kind === "group" && x.id === "dpad");
          if (!groupItem) return null;

          const v = getConsoleGroupValue(layout, "dpad");
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
                onBindDpad={() => startBind({ kind: "dpad", group: "dpad" })}
                onBindStick={() => void 0}
                onClear={() => void saveLayout(clearConsoleGroup(layout, "dpad"))}
                dirIcons={dpadIcons}
              />
            </div>
          );
        }

        if (sec.key === "rightStick") {
          const groupItem = items.find((x) => x.kind === "group" && (x.id === "special.c" || x.id === "look"));
          if (!groupItem) return null;

          const groupId = groupItem.id as ConsoleGroupId;
          const v = getConsoleGroupValue(layout, groupId);
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
                onSetMode={(mode) => void saveLayout(setConsoleGroupMode(layout, groupId, mode))}
                onBindDpad={() => startBind({ kind: "dpad", group: groupId })}
                onBindStick={() => startBind({ kind: "stick", group: groupId, stick: "right" })}
                onClear={() => void saveLayout(clearConsoleGroup(layout, groupId))}
                dirIcons={dpadIcons}
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
                  const binding = getConsoleDigitalById(layout, id);
                  const active = isDigitalPressed(binding);
                  const listening = bindStateActive && planEquals({ kind: "digital", path: id });

                  return (
                    <DigitalBindingCard
                      key={`${layout.consoleId}:${id}`}
                      title={item.label}
                      iconSrc={item.icon}
                      binding={binding}
                      isActive={active}
                      isListening={listening}
                      onBind={() => startBind({ kind: "digital", path: id })}
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
