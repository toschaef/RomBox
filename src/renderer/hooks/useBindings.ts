import { useEffect, useMemo, useState } from "react";
import type { ActionBindings, LogicalAction, PhysicalBinding } from "../../shared/types/controls";
import { createEmptyBindings } from "../config/controllerLayouts";

const STORAGE_KEY = "bindings";

function isPhysicalBinding(item: unknown): item is PhysicalBinding {
  if (!item || typeof item !== "object") return false;

  const record = item as Record<string, unknown>;

  return (
    (record.device === "keyboard" || record.device === "gamepad") &&
    typeof record.input === "string"
  );
}

function mergeWithDefaults(saved: unknown): ActionBindings {
  const defaults = createEmptyBindings();

  if (!saved || typeof saved !== "object") return defaults;

  const obj = saved as Record<string, unknown>;
  const merged: ActionBindings = { ...defaults };

  (Object.keys(defaults) as LogicalAction[]).forEach((key) => {
    const value = obj[key];

    if (Array.isArray(value)) {
      merged[key] = value.filter(isPhysicalBinding);
    }
  });

  return merged;
}

export function useBindings() {
  const defaults = useMemo(() => createEmptyBindings(), []);

  const [bindings, setBindings] = useState<ActionBindings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return mergeWithDefaults(parsed);
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    setBindings((prev) => ({ ...defaults, ...prev }));
  }, [defaults]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  }, [bindings]);

  const bindAction = (action: LogicalAction, input: PhysicalBinding) => {
    setBindings((prev) => {
      const current = prev[action] ?? [];

      const exists = current.some((b) => b.device === input.device && b.input === input.input);
      if (exists) return prev;

      return { ...prev, [action]: [...current, input] };
    });
  };

  const clearAction = (action: LogicalAction) => {
    setBindings((prev) => ({ ...prev, [action]: [] }));
  };

  const resetAll = () => setBindings(createEmptyBindings());

  return { bindings, bindAction, clearAction, resetAll };
}