import { useMemo } from "react";
import type { DpadBinding, StickBinding, DigitalBinding } from "../../../shared/types/controls";

function fmtStick(s: StickBinding) {
  return `${s.stick === "left" ? "Left Stick" : "Right Stick"} dz=${Math.round(s.deadzone * 100)}%`;
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

function DpadGrid({ d }: { d: DpadBinding }) {
  const Cell = ({ label, value }: { label: string; value?: DigitalBinding }) => {
    const mapped = !!value;
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-secondary p-2">
        <div className="text-[10px] uppercase tracking-widest font-bold text-fg-muted">{label}</div>
        <div className={`mt-1 text-xs font-mono ${mapped ? "text-fg-primary" : "text-fg-muted"}`}>
          {fmtDigital(value)}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 pointer-events-none">
      <Cell label="Up" value={d.up} />
      <Cell label="Right" value={d.right} />
      <Cell label="Left" value={d.left} />
      <Cell label="Down" value={d.down} />
    </div>
  );
}

export default function GroupBindingCard(props: {
  title: string;

  value: DpadBinding | StickBinding;
  listening: boolean;
  active: boolean;

  onBindDpad: () => void;
  onBindStick: () => void;

  onClear: () => void;

  stickChoice?: "left" | "right";
  onSetMode: (mode: "dpad" | "stick") => void;

  hint?: string;
}) {
  const { title, value, listening, active, onBindDpad, onBindStick, onClear, onSetMode, hint } = props;

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
        relative w-full p-4 rounded-xl border text-left cursor-pointer my-6
        transition-all ${transitionClass}
        ${listening ? "border-accent-secondary bg-accent-muted/30" : "border-border-subtle bg-bg-secondary hover:bg-bg-muted hover:border-border-muted"}
        ${active ? "ring-1 ring-accent-secondary shadow-[0_0_30px_rgba(124,58,237,0.5)] border-accent-secondary/50 bg-accent-muted/20 z-10 scale-[1.02]" : "scale-100"}
      `}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center gap-3">
            <span className={`font-bold text-sm transition-colors ${transitionClass} ${active ? "text-white" : "text-fg-primary"}`}>
              {title}
            </span>

            <div className="flex items-center gap-2">
              <div
                className="flex bg-bg-secondary rounded-lg p-1 border border-border-subtle"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onSetMode("dpad")}
                  className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                    mode === "dpad" ? "bg-accent-secondary text-white" : "text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted"
                  }`}
                  title="Bind as 4 buttons"
                >
                  Buttons
                </button>
                <button
                  type="button"
                  onClick={() => onSetMode("stick")}
                  className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
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
                  className="text-xs text-fg-muted hover:text-red-400 px-2 py-1 transition-colors duration-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {value.type === "stick" ? (
            <div
              className={`
                text-xs mt-1 truncate font-mono transition-colors ${transitionClass}
                ${listening ? "text-accent-secondary animate-pulse" : ""}
                ${!listening && active ? "text-accent-highlight" : ""}
                ${!listening && !active ? "text-fg-muted" : ""}
              `}
            >
              {listening ? "Press input..." : fmtStick(value)}
            </div>
          ) : (
            <div className={`transition-colors ${transitionClass}`}>
              {listening ? (
                <div className="text-xs mt-1 font-mono text-accent-secondary animate-pulse">Press input...</div>
              ) : (
                <DpadGrid d={value} />
              )}
            </div>
          )}

          {hint ? <div className="text-[10px] mt-2 text-fg-muted uppercase tracking-widest font-bold">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}