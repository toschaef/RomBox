import { CONSOLE_CATALOG } from "../../shared/emulators/catalog";
import type { ConsoleID } from "../../shared/types";

// guards for values arriving over IPC

export function isConsoleId(value: unknown): value is ConsoleID {
  return typeof value === "string" && value in CONSOLE_CATALOG;
}

export function assertConsoleId(value: unknown): asserts value is ConsoleID {
  if (!isConsoleId(value)) {
    throw new Error(`Unknown console: ${String(value)}`);
  }
}
