import BindingCard from "./BindingCard";
import type { ActionDef, ActionBindings, LogicalAction } from "../../../shared/types/controls";

export default function ControlsSection(props: {
  items: ActionDef[];
  bindings: ActionBindings;
  listeningFor: LogicalAction | null;

  isActionActive: (action: LogicalAction) => boolean;
  onStartListening: (action: LogicalAction) => void;
  onClearAction: (action: LogicalAction) => void;
}) {
  const { items, bindings, listeningFor, isActionActive, onStartListening, onClearAction } =
    props;

  if (!items.length) return null;

  return (
    <section className="mb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {items.map((item) => (
          <BindingCard
            key={item.id}
            title={item.label}
            iconSrc={item.icon}
            bindings={bindings[item.id] ?? []}
            isListening={listeningFor === item.id}
            isActive={isActionActive(item.id)}
            onClick={() => onStartListening(item.id)}
            onClear={() => onClearAction(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
