import { PhysicalBinding } from "../../../shared/types/controls";

function formatLabel(b: PhysicalBinding) {
  if (b.device === "keyboard") return b.input.replace("Key", "");
  return b.input.replace("GP_", "").replace("BTN_", "B").replace("_", " ").replace("Digit", "");
}

interface ActionTileProps {
  title: string;
  iconSrc: string;
  bindings?: PhysicalBinding[];
  isListening: boolean;
  isActive: boolean;
  onClick: () => void;
  onClear: () => void;
}

export default function ActionTile({
  title,
  iconSrc,
  bindings,
  isListening,
  isActive,
  onClick,
  onClear,
}: ActionTileProps) {
  const transitionClass = isActive ? "duration-75 ease-out" : "duration-1000 ease-out";

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full p-4 rounded-xl border text-left cursor-pointer
        transition-all ${transitionClass}
        ${isListening 
          ? "border-accent-secondary bg-accent-muted/30" 
          : "border-border-subtle bg-bg-secondary hover:bg-bg-muted hover:border-border-muted"
        }
        ${isActive 
          ? "ring-1 ring-accent-secondary shadow-[0_0_30px_rgba(124,58,237,0.5)] border-accent-secondary/50 bg-accent-muted/20 z-10 scale-[1.02]" 
          : "scale-100"
        }
      `}
    >
      <div className="flex items-center gap-4">
        <div 
          className={`
            p-2 rounded-lg border transition-colors ${transitionClass}
            ${isActive 
              ? 'bg-accent-secondary border-accent-highlight shadow-inner' 
              : 'border-border-subtle bg-bg-primary'
            }
          `}
        >
             <img src={iconSrc} alt={title} className="w-8 h-8 object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <span className={`font-bold text-sm transition-colors ${transitionClass} ${isActive ? 'text-white' : 'text-fg-primary'}`}>
              {title}
            </span>
            {(bindings?.length ?? 0) > 0 && (
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
            {isListening
              ? "Press input..."
              : bindings?.map(formatLabel).join(" + ") || "Unmapped"}
          </div>
        </div>
      </div>
    </div>
  );
}