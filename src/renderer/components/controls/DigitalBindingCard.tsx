import type { DigitalBinding } from "../../../shared/types/controls";

function formatDigital(d?: DigitalBinding): string {
  if (!d) return "Unmapped";
  if (d.type === "key") return d.code.replace("Key", "");
  if (d.type === "gp_button") return d.token.replace("GP_", "").replaceAll("_", " ");
  return `${d.stick === "left" ? "LS" : "RS"} ${d.axis.toUpperCase()}${d.dir === "neg" ? "-" : "+"}`;
}

export default function DigitalBindingCard(props: {
  title: string;
  iconSrc: string;

  binding?: DigitalBinding;
  isListening: boolean;
  isActive: boolean;

  onBind: () => void;
  onClear: () => void;
}) {
  const { title, iconSrc, binding, isListening, isActive, onBind, onClear } = props;

  const transitionClass = isActive ? "duration-75 ease-out" : "duration-1000 ease-out";
  const has = !!binding;

  return (
    <div
      onClick={onBind}
      className={`
        relative w-full p-4 rounded-sm border text-left cursor-pointer
        transition-all ${transitionClass}
        ${isListening ? "border-accent-secondary bg-accent-muted/30" : "border-border-subtle bg-bg-secondary hover:bg-bg-muted hover:border-border-muted"}
        ${isActive ? "ring-1 ring-accent-secondary shadow-[0_0_30px_rgba(124,58,237,0.5)] border-accent-secondary/50 bg-accent-muted/20 z-10 scale-[1.02]" : "scale-100"}
      `}
    >
      <div className="flex items-center gap-4">
        <div
          className={`
            p-2 rounded-sm border transition-colors ${transitionClass}
            ${isActive ? "bg-accent-secondary border-accent-highlight shadow-inner" : "border-border-subtle bg-bg-primary"}
          `}
        >
          <img src={iconSrc} alt={title} className="w-8 h-8 object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <span className={`font-bold text-sm transition-colors ${transitionClass} ${isActive ? "text-white" : "text-fg-primary"}`}>
              {title}
            </span>

            {has && (
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

          <div
            className={`
              text-xs mt-1 truncate font-mono transition-colors ${transitionClass}
              ${isListening ? "text-accent-secondary animate-pulse" : ""}
              ${!isListening && isActive ? "text-accent-highlight" : ""}
              ${!isListening && !isActive ? "text-fg-muted" : ""}
            `}
          >
            {isListening ? "Press input" : formatDigital(binding)}
          </div>
        </div>
      </div>
    </div>
  );
}