import { useEffect, useState, useRef, useMemo } from "react";
import { useControllerInput } from "../hooks/useControllerInput";
import { SECTION_ORDER } from "../config/controllerLayouts";
import type { LogicalAction } from "../../shared/types/controls";
import ControlsHeader from "../components/controls/ControlsHeader";
import ListeningOverlay from "../components/controls/ListeningOverlay";
import ControlsSection from "../components/controls/ControlsSection";
import { useControlsPage } from "../hooks/useControlsPage";

export default function Controls() {
  const {
    profiles,
    activeProfileId,
    bindings,
    itemsBySection,
    guidedOrder,
    changeProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    setAsDefault,
    bindAction,
    clearAction,
    resetAll,
  } = useControlsPage();

  const [listeningFor, setListeningFor] = useState<LogicalAction | null>(null);
  const [listenStartedAt, setListenStartedAt] = useState<number | null>(null);
  const [guided, setGuided] = useState(false);
  const [guidedIndex, setGuidedIndex] = useState(0);

  const { 
    lastDetectedInput, 
    lastDetectedAt, 
    currentlyPressed, 
    clearLastDetectedInput 
  } = useControllerInput();

  const [visuallyActive, setVisuallyActive] = useState<Set<LogicalAction>>(new Set());
  const timeouts = useRef<Map<LogicalAction, NodeJS.Timeout>>(new Map());

  const actionLabels = useMemo(() => {
    const map = new Map<LogicalAction, string>();
    itemsBySection.forEach((items) => {
      items.forEach((item) => {
        map.set(item.id, item.label);
      });
    });
    return map;
  }, [itemsBySection]);

  useEffect(() => {
    if (!bindings) return;

    setVisuallyActive((prev) => {
      const next = new Set(prev);
      let hasChanges = false;

      Object.entries(bindings).forEach(([key, actionBindings]) => {
        const action = key as LogicalAction;
        const isPhysicallyPressed = actionBindings.some((b) => currentlyPressed.has(b.input));

        if (isPhysicallyPressed) {
          if (!next.has(action)) {
            next.add(action);
            hasChanges = true;
          }
          if (timeouts.current.has(action)) {
            clearTimeout(timeouts.current.get(action));
            timeouts.current.delete(action);
          }
        } else {
          if (next.has(action)) {
            if (!timeouts.current.has(action)) {
              const tId = setTimeout(() => {
                setVisuallyActive((curr) => {
                  const n = new Set(curr);
                  n.delete(action);
                  return n;
                });
                timeouts.current.delete(action);
              }, 50); // hold for 50ms
              
              timeouts.current.set(action, tId);
            }
          }
        }
      });

      return hasChanges ? next : prev;
    });
    
    return () => {
        // clear timeouts on unmount
    };
  }, [currentlyPressed, bindings]);

  const isActionActive = (action: LogicalAction) => visuallyActive.has(action);

  const startListening = (action: LogicalAction) => {
    clearLastDetectedInput();
    setListeningFor(action);
    setListenStartedAt(performance.now());
  };

  const stopListening = () => {
    setListeningFor(null);
    setListenStartedAt(null);
    clearLastDetectedInput();
  };

  const startGuided = () => {
    if (!guidedOrder.length) return;
    setGuided(true);
    setGuidedIndex(0);
    startListening(guidedOrder[0]);
  };

  const stopGuided = () => {
    setGuided(false);
    setGuidedIndex(0);
    stopListening();
  };

  const onToggleGuided = () => {
    if (guided) stopGuided();
    else startGuided();
  };

  useEffect(() => {
    if (!listeningFor || !lastDetectedInput || !lastDetectedAt || !listenStartedAt) return;
    if (lastDetectedAt <= listenStartedAt) return;

    if (lastDetectedInput.device === "keyboard" && lastDetectedInput.input === "Escape") {
      stopGuided();
      return;
    }

    void bindAction(listeningFor, lastDetectedInput);

    if (guided) {
      const nextIndex = guidedIndex + 1;
      const nextAction = guidedOrder[nextIndex];

      if (nextAction) {
        setGuidedIndex(nextIndex);
        setTimeout(() => startListening(nextAction), 150);
      } else {
        stopGuided();
      }
    } else {
      stopListening();
    }
  }, [listeningFor, lastDetectedInput, lastDetectedAt]);

  if (!bindings || !activeProfileId) {
    return (
      <div className="h-full w-full p-8 text-fg-muted">
        Loading controls…
      </div>
    );
  }

  const listeningLabel = listeningFor ? (actionLabels.get(listeningFor) || listeningFor) : "";

  return (
    <div className="h-full w-full p-4 overflow-y-auto">
      <ControlsHeader
        profiles={profiles}
        activeProfileId={activeProfileId}
        onChangeProfile={(id) => {
          stopGuided();
          void changeProfile(id);
        }}
        onCreateProfile={(name) => void createProfile(name)}
        onRenameProfile={(id, name) => void renameProfile(id, name)}
        onDeleteProfile={(id) => void deleteProfile(id)}
        onSetDefault={(id) => void setAsDefault(id)}
        guided={guided}
        onToggleGuided={onToggleGuided}
        onResetDefaults={() => {
          stopGuided();
          void resetAll();
        }}
      />

      {listeningFor &&
        <ListeningOverlay
          listeningFor={listeningLabel} 
          guided={guided}
        />
      }

      {SECTION_ORDER.map((sec) => (
        <ControlsSection
          key={sec.key}
          items={itemsBySection.get(sec.key) ?? []}
          bindings={bindings}
          listeningFor={listeningFor}
          isActionActive={isActionActive}
          onStartListening={(action) => {
            stopGuided(); 
            startListening(action);
          }}
          onClearAction={(action) => void clearAction(action)}
        />
      ))}
    </div>
  );
}