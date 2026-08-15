import type { DigitalBinding } from "../../../shared/types/controls";
import { Button, Card } from "../../ui";

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
  const speed = isActive ? "instant" : "decay";
  const has = !!binding;

  return (
    <Card
      onClick={onBind}
      data-testid="binding-card"
      data-binding-title={title}
      padding="sm"
      speed={speed}
      interactive={!isListening && !isActive}
      state={isActive ? "active" : isListening ? "listening" : "default"}
      className="w-full text-left cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div
            className={`p-1.5 rounded-sm border transition-colors ${
              isActive
                ? "duration-instant bg-accent-muted border-accent-secondary shadow-inner"
                : "duration-decay border-border-subtle bg-bg-primary"
            }`}
          >
            <img src={iconSrc} alt={title} className="w-12 h-12 object-contain" />
          </div>

          <div className="flex-1 min-w-0">
            <span className={`font-bold text-sm transition-colors ${isActive ? "text-white" : "text-fg-primary"}`}>
              {title}
            </span>

            <div
              className={`text-xs mt-1 truncate font-mono transition-colors ${
                isListening
                  ? "text-accent-secondary animate-pulse"
                  : isActive
                    ? "text-accent-highlight"
                    : "text-fg-muted"
              }`}
            >
              {isListening ? "Press input" : formatDigital(binding)}
            </div>
          </div>
        </div>

        {has && (
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
    </Card>
  );
}
