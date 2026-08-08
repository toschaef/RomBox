import type { AnyConsoleLayout, ControlsProfile, PlayerBindings, PlayerKey } from "../../shared/types/controls";
import { getPlayerControllerId, withPlayerControllerId } from "../../shared/controls/controllerModels";

export const PLAYER_KEYS: PlayerKey[] = ["player1", "player2", "player3", "player4"];

/**
 * Returns, for each destination slot (index = new tab position), which
 * original PlayerKey's data should now live there - i.e. the standard
 * "move item from `from` to `to`, shifting the rest" drag-reorder semantics.
 */
export function movePlayerSlot(from: number, to: number): PlayerKey[] {
  const order = [...PLAYER_KEYS];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return order;
}

export function reorderProfilePlayers(profile: ControlsProfile, order: PlayerKey[]): ControlsProfile {
  const bindings: Record<PlayerKey, PlayerBindings | undefined> = {
    player1: profile.player1,
    player2: profile.player2,
    player3: profile.player3,
    player4: profile.player4,
  };

  const next = { ...profile };
  PLAYER_KEYS.forEach((slotKey, i) => {
    const value = bindings[order[i]];
    if (slotKey === "player1") {
      // player1 bindings are mandatory - fall back rather than leaving them unset
      // if an unconfigured player (undefined) got dragged into slot 1.
      next.player1 = value ?? profile.player1;
    } else {
      next[slotKey] = value;
    }
  });

  return next;
}

function setControllerIdField(layout: AnyConsoleLayout, slotKey: PlayerKey, value: string | undefined): AnyConsoleLayout {
  return withPlayerControllerId(layout, slotKey, value);
}

export function reorderConsoleLayoutPlayers(layout: AnyConsoleLayout, order: PlayerKey[], profile?: ControlsProfile): AnyConsoleLayout {
  // A player slot that was never individually customized for THIS console has
  // no entry in the raw layout row (undefined), even though it's still
  // effectively inheriting bindings from the standard profile - that's exactly
  // what getEffectiveConsoleLayout falls back to at launch. Without this same
  // fallback here, dragging that (apparently-empty) slot into player1 hits the
  // "don't leave player1 empty" safety net below and silently no-ops: player1
  // keeps its own old bindings instead of picking up what's actually in effect
  // for the player being dragged in.
  const bindings: Record<PlayerKey, PlayerBindings | undefined> = {
    player1: layout.player1 ?? profile?.player1,
    player2: layout.player2 ?? profile?.player2,
    player3: layout.player3 ?? profile?.player3,
    player4: layout.player4 ?? profile?.player4,
  };
  const controllerIds: Record<PlayerKey, string | undefined> = {
    player1: getPlayerControllerId(layout, "player1"),
    player2: getPlayerControllerId(layout, "player2"),
    player3: getPlayerControllerId(layout, "player3"),
    player4: getPlayerControllerId(layout, "player4"),
  };

  let next = { ...layout };
  PLAYER_KEYS.forEach((slotKey, i) => {
    const sourceKey = order[i];
    const value = bindings[sourceKey];
    next = slotKey === "player1"
      ? { ...next, player1: value ?? layout.player1 }
      : { ...next, [slotKey]: value };
    next = setControllerIdField(next, slotKey, controllerIds[sourceKey]);
  });

  return next;
}
