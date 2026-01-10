import type { ConsoleID } from "../../shared/types";
import type { ControlsProfile, AnyConsoleLayout, PlayerBindings } from "../../shared/types/controls";
import { makeDefaultConsoleBindings } from "../../shared/controls/layoutDefaults";

export async function resolveConsoleBindings(args: {
  consoleId: ConsoleID;
  profile: ControlsProfile;
  consoleLayout?: AnyConsoleLayout | null;
}): Promise<PlayerBindings> {
  const { consoleId, profile, consoleLayout } = args;

  if (consoleLayout?.bindings) {
    return consoleLayout.bindings;
  }

  return makeDefaultConsoleBindings(consoleId, profile) as PlayerBindings;
}