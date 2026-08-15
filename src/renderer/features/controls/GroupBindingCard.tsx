import { useMemo } from "react";
import type { DpadBinding, StickBinding, DigitalBinding } from "../../../shared/types/controls";
import genericUp from "../../assets/controls/Nintendo Switch/Vector/switch_dpad_up_outline.svg";
import genericDown from "../../assets/controls/Nintendo Switch/Vector/switch_dpad_down_outline.svg";
import genericLeft from "../../assets/controls/Nintendo Switch/Vector/switch_dpad_left_outline.svg";
import genericRight from "../../assets/controls/Nintendo Switch/Vector/switch_dpad_right_outline.svg";
import { Button, Card, SegmentedControl } from "../../ui";

const GENERIC_DIR_ICONS = {
  up: genericUp,
  down: genericDown,
  left: genericLeft,
  right: genericRight,
};

const MODE_OPTIONS = [
  { value: "dpad" as const, label: "Buttons", title: "Bind as 4 buttons" },
  { value: "stick" as const, label: "Stick", title: "Bind as stick" },
];

function fmtStick(s: StickBinding) {
  return `${s.stick === "left" ? "Left Stick" : "Right Stick"}`;
}

function fmtDigital(d?: DigitalBinding) {
  if (!d) return "Unmapped";
  if (d.type === "key") return d.code;
  if (d.type === "gp_button") return d.token;

  const stick = d.stick === "left" ? "LS" : "RS";
  const axis = d.axis.toUpperCase();
  const dir = d.dir === "neg" ? "-" : "+";
  return `${stick} ${axis}${dir}`;
}

interface Props {
  title: string;

  value: DpadBinding | StickBinding;
  listening: boolean;
  active: boolean;

  onBindDpad: () => void;
  onBindStick: () => void;

  onClear: () => void;

  stickChoice?: "left" | "right";
  onSetMode: (mode: "dpad" | "stick") => void;
  isPressed?: (d?: DigitalBinding) => boolean;
  dirIcons?: { up: string; down: string; left: string; right: string };
}

function Cell({
  label,
  value,
  isPressed,
  iconSrc,
}: {
  label: string;
  value?: DigitalBinding;
  isPressed?: (d?: DigitalBinding) => boolean;
  iconSrc?: string;
}) {
  const mapped = !!value;
  const active = isPressed?.(value) ?? false;

  return (
    <Card
      padding="none"
      speed={active ? "instant" : "decay"}
      state={active ? "active" : "default"}
      className={`flex flex-col items-center justify-center p-1 min-h-14 h-36 flex-1 ${
        !active && mapped ? "bg-bg-highlight" : ""
      }`}
    >
      <div
        className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 transition-colors ${
          active ? "text-accent-secondary duration-instant" : "text-fg-muted duration-decay"
        }`}
      >
        {label}
      </div>
      {iconSrc && (
        <div
          className={`my-1 p-1 rounded-sm border transition-colors ${
            active
              ? "duration-instant bg-accent-muted border-accent-secondary shadow-inner"
              : "duration-decay border-border-subtle bg-bg-primary"
          }`}
        >
          <img src={iconSrc} alt={label} className="w-12 h-12 object-contain" />
        </div>
      )}
      <div
        className={`text-xs font-mono font-bold truncate max-w-full px-1 transition-colors ${
          active ? "text-accent-highlight duration-instant" : mapped ? "text-accent-primary duration-decay" : "text-fg-muted/50 duration-decay"
        }`}
      >
        {fmtDigital(value) || "-"}
      </div>
    </Card>
  );
}

function DpadGrid({
  d,
  isPressed,
  dirIcons,
}: {
  d: DpadBinding;
  isPressed?: (d?: DigitalBinding) => boolean;
  dirIcons: { up: string; down: string; left: string; right: string };
}) {
  return (
    <div className="mt-4 flex gap-2 pointer-events-none mx-auto w-full">
      <Cell label="Left" value={d.left} isPressed={isPressed} iconSrc={dirIcons.left} />
      <Cell label="Down" value={d.down} isPressed={isPressed} iconSrc={dirIcons.down} />
      <Cell label="Up" value={d.up} isPressed={isPressed} iconSrc={dirIcons.up} />
      <Cell label="Right" value={d.right} isPressed={isPressed} iconSrc={dirIcons.right} />
    </div>
  );
}

export default function GroupBindingCard(props: Props) {
  const { title, value, listening, active, onBindDpad, onBindStick, onClear, onSetMode, isPressed, dirIcons } = props;

  const mode: "dpad" | "stick" = value.type === "dpad" ? "dpad" : "stick";

  const hasAny = useMemo(() => {
    if (value.type === "stick") return true;
    return !!(value.up || value.down || value.left || value.right);
  }, [value]);

  const bind = () => {
    if (mode === "stick") onBindStick();
    else onBindDpad();
  };

  return (
    <Card
      onClick={bind}
      data-testid="binding-card"
      data-binding-title={title}
      padding="sm"
      speed={active ? "instant" : "decay"}
      interactive={!listening}
      state={listening ? "listening" : "default"}
      className={`w-full text-left cursor-pointer ${listening ? "ring-1 ring-accent-secondary" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center gap-3">
            <span className="font-bold text-sm text-fg-primary">{title}</span>

            <div className="flex items-center gap-2">
              <div onClick={(e) => e.stopPropagation()}>
                <SegmentedControl
                  bordered={false}
                  size="sm"
                  options={MODE_OPTIONS}
                  value={mode}
                  onChange={onSetMode}
                />
              </div>

              {hasAny && (
                <Button
                  intent="secondary"
                  size="xs"
                  className="text-fg-muted hover:text-red-400 hover:border-red-400/50 bg-bg-primary/50 px-2.5 py-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {value.type === "stick" ? (
            <div className="mt-4 flex gap-2 pointer-events-none mx-auto w-full">
              <Card
                padding="none"
                speed={active ? "instant" : "decay"}
                state={!listening && active ? "active" : "default"}
                className={`flex flex-col items-center justify-center p-1 h-24 flex-1 ${
                  listening ? "bg-accent-muted/10 border-accent-secondary text-accent-secondary" : ""
                } ${!active && !listening ? "bg-bg-highlight text-accent-primary" : ""}`}
              >
                <div
                  className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 transition-colors ${
                    active ? "text-accent-secondary duration-instant" : "text-fg-muted duration-decay"
                  }`}
                >
                  Stick
                </div>
                <div
                  className={`text-xs font-mono font-bold truncate max-w-full px-1 transition-colors ${
                    active ? "text-accent-highlight duration-instant" : "text-accent-primary duration-decay"
                  }`}
                >
                  {listening ? "Move Stick..." : fmtStick(value)}
                </div>
              </Card>
            </div>
          ) : (
            <div className="transition-colors duration-base">
              {listening ? (
                <div className="text-xs mt-1 font-mono text-accent-secondary animate-pulse">Press input...</div>
              ) : (
                <DpadGrid d={value} isPressed={isPressed} dirIcons={dirIcons ?? GENERIC_DIR_ICONS} />
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
