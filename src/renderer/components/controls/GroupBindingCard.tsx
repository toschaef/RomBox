import { useMemo } from "react";
import type { DpadBinding, StickBinding, DigitalBinding } from "../../../shared/types/controls";
import genericUp from "../../assets/controls/Nintendo Switch/Vector/switch_dpad_up_outline.svg";
import genericDown from "../../assets/controls/Nintendo Switch/Vector/switch_dpad_down_outline.svg";
import genericLeft from "../../assets/controls/Nintendo Switch/Vector/switch_dpad_left_outline.svg";
import genericRight from "../../assets/controls/Nintendo Switch/Vector/switch_dpad_right_outline.svg";

const GENERIC_DIR_ICONS = {
  up: genericUp,
  down: genericDown,
  left: genericLeft,
  right: genericRight,
};

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
  const transitionClass = active ? "duration-75 ease-out" : "duration-1000 ease-out";

  return (
    <div className={`
      flex flex-col items-center justify-center 
      rounded-sm border p-1
      min-h-14
      h-36
      flex-1
      transition-all ${transitionClass}
      ${active 
          ? "ring-1 ring-accent-secondary border-accent-secondary bg-accent-muted/20 shadow-[0_0_20px_rgba(124,58,237,0.4)] scale-[1.02] z-10" 
          : "border-border-subtle bg-bg-secondary/50 scale-100"
      }
      ${!active && mapped ? "bg-bg-highlight" : ""}
    `}>
      <div className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 transition-colors ${transitionClass} ${active ? "text-accent-secondary" : "text-fg-muted"}`}>
        {label}
      </div>
      {iconSrc && (
        <div className={`my-1 p-1 rounded-sm border transition-colors ${transitionClass} ${active ? "bg-accent-secondary border-accent-highlight shadow-inner" : "border-border-subtle bg-bg-primary"}`}>
          <img src={iconSrc} alt={label} className="w-12 h-12 object-contain" />
        </div>
      )}
      <div className={`
        text-xs font-mono font-bold truncate max-w-full px-1 transition-colors ${transitionClass}
        ${active ? "text-accent-highlight" : (mapped ? "text-accent-primary" : "text-fg-muted/50")}
      `}>
        {fmtDigital(value) || "-"}
      </div>
    </div>
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

  const transitionClass = active ? "duration-75 ease-out" : "duration-1000 ease-out";
  const hasAny = useMemo(() => {
    if (value.type === "stick") return true;
    return !!(value.up || value.down || value.left || value.right);
  }, [value]);

  const bind = () => {
    if (mode === "stick") onBindStick();
    else onBindDpad();
  };

  return (
    <div
      onClick={bind}
      className={`
        relative w-full p-4 rounded-sm border text-left cursor-pointer
        transition-all ${transitionClass}
        ${listening ? "border-accent-secondary bg-accent-muted/30 ring-1 ring-accent-secondary" : "border-border-subtle bg-bg-secondary hover:bg-bg-muted hover:border-border-muted"}
      `}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center gap-3">
            <span className={`font-bold text-sm transition-colors duration-200 text-fg-primary`}>
              {title}
            </span>

            <div className="flex items-center gap-2">
              <div
                className="flex bg-bg-secondary rounded-sm p-1 border border-border-subtle"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onSetMode("dpad")}
                  className={`px-2 py-1 text-xs font-bold rounded-xs transition-colors ${
                    mode === "dpad" ? "bg-accent-secondary text-white" : "text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted"
                  }`}
                  title="Bind as 4 buttons"
                >
                  Buttons
                </button>
                <button
                  type="button"
                  onClick={() => onSetMode("stick")}
                  className={`px-2 py-1 text-xs font-bold rounded-xs transition-colors ${
                    mode === "stick" ? "bg-accent-secondary text-white" : "text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted"
                  }`}
                  title="Bind as stick"
                >
                  Stick
                </button>
              </div>

              {hasAny && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="text-xs text-fg-muted hover:text-red-400 hover:border-red-400/50 px-2.5 py-1 rounded-sm border border-border-subtle bg-bg-primary/50 transition-colors duration-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {value.type === "stick" ? (
             <div className="mt-4 flex gap-2 pointer-events-none mx-auto w-full">
               <div className={`
                 flex flex-col items-center justify-center 
                 rounded-sm border p-1
                 h-24
                 flex-1
                 transition-all ${transitionClass}
                 ${!listening && active 
                     ? "ring-1 ring-accent-secondary border-accent-secondary bg-accent-muted/20 shadow-[0_0_20px_rgba(124,58,237,0.4)] scale-[1.02] z-10" 
                     : "border-border-subtle bg-bg-secondary/50 scale-100"
                 }
                 ${listening ? "bg-accent-muted/10 border-accent-secondary text-accent-secondary" : ""}
                 ${!active && !listening ? "bg-bg-highlight text-accent-primary" : ""}
               `}>
                 <div className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 transition-colors ${transitionClass} ${active ? "text-accent-secondary" : "text-fg-muted"}`}>
                   Stick
                 </div>
                 <div className={`
                   text-xs font-mono font-bold truncate max-w-full px-1 transition-colors ${transitionClass}
                   ${active ? "text-accent-highlight" : "text-accent-primary"}
                 `}>
                   {listening ? "Move Stick..." : fmtStick(value)}
                 </div>
               </div>
             </div>
          ) : (
            <div className={`transition-colors duration-200`}>
              {listening ? (
                <div className="text-xs mt-1 font-mono text-accent-secondary animate-pulse">Press input...</div>
              ) : (
                <DpadGrid d={value} isPressed={isPressed} dirIcons={dirIcons ?? GENERIC_DIR_ICONS} />
              )}
            </div>
          )}

          
        </div>
      </div>
    </div>
  );
}