import { movePlayerSlot, reorderProfilePlayers, reorderConsoleLayoutPlayers, PLAYER_KEYS } from "../../../../src/renderer/controls/reorderPlayers";
import { createDefaultProfileShape } from "../../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile, AnyConsoleLayout, PlayerBindings } from "../../../../src/shared/types/controls";

function bindings(tag: string): PlayerBindings {
  return {
    move: { type: "dpad" },
    dpad: { type: "dpad" },
    look: { type: "dpad" },
    face: { type: "face", primary: { type: "key", code: tag } },
    shoulders: { type: "shoulders" },
    system: { type: "system" },
  };
}

function makeProfile(): ControlsProfile {
  return {
    id: "p1",
    name: "Standard",
    createdAt: 0,
    updatedAt: 0,
    isDefault: true,
    preferredDevice: "auto",
    ...createDefaultProfileShape(),
    player1: bindings("P1"),
    player2: bindings("P2"),
    player3: bindings("P3"),
    player4: bindings("P4"),
  };
}

function makeLayout(): AnyConsoleLayout {
  return {
    id: "l1",
    consoleId: "snes",
    profileId: "p1",
    createdAt: 0,
    updatedAt: 0,
    isUserModified: true,
    controllerIds: ["gamepad-1", "gamepad-2", undefined, undefined],
    player1: bindings("P1"),
    player2: bindings("P2"),
    player3: bindings("P3"),
    player4: undefined,
  };
}

describe("movePlayerSlot", () => {
  it("swaps two adjacent slots", () => {
    // dragging P2 (index 1) onto P1 (index 0)
    const order = movePlayerSlot(1, 0);
    expect(order).toEqual(["player2", "player1", "player3", "player4"]);
  });

  it("shifts the players in between when moving a far slot", () => {
    // dragging P4 (index 3) onto P1 (index 0)
    const order = movePlayerSlot(3, 0);
    expect(order).toEqual(["player4", "player1", "player2", "player3"]);
  });

  it("returns the identity order for a no-op move", () => {
    const order = movePlayerSlot(2, 2);
    expect(order).toEqual(PLAYER_KEYS);
  });
});

describe("reorderProfilePlayers", () => {
  it("swaps P1 and P2 bindings when P2 is dragged onto P1", () => {
    const profile = makeProfile();
    const order = movePlayerSlot(1, 0);
    const next = reorderProfilePlayers(profile, order);

    expect(next.player1?.face.primary).toEqual({ type: "key", code: "P2" });
    expect(next.player2?.face.primary).toEqual({ type: "key", code: "P1" });
    expect(next.player3?.face.primary).toEqual({ type: "key", code: "P3" });
    expect(next.player4?.face.primary).toEqual({ type: "key", code: "P4" });
  });

  it("falls back to the previous player1 bindings if an unconfigured player lands in slot 1", () => {
    const profile = makeProfile();
    profile.player2 = undefined;
    const order = movePlayerSlot(1, 0); // move empty player2 into player1's slot
    const next = reorderProfilePlayers(profile, order);

    expect(next.player1).toEqual(profile.player1);
  });
});

describe("reorderConsoleLayoutPlayers", () => {
  it("moves both bindings and per-player controller ids together", () => {
    const layout = makeLayout();
    const order = movePlayerSlot(1, 0); // drag P2 onto P1
    const next = reorderConsoleLayoutPlayers(layout, order);

    expect(next.player1?.face.primary).toEqual({ type: "key", code: "P2" });
    expect(next.player2?.face.primary).toEqual({ type: "key", code: "P1" });
    expect(next.controllerIds?.[0]).toBe("gamepad-2");
    expect(next.controllerIds?.[1]).toBe("gamepad-1");
  });

  it("clears the destination controller id when the incoming player never had one", () => {
    const layout = makeLayout();
    const order = movePlayerSlot(3, 1); // drag empty P4 onto P2 (which has a controller id)
    const next = reorderConsoleLayoutPlayers(layout, order);

    expect(next.controllerIds?.[1]).toBeUndefined();
  });

  it("falls back to the standard profile's bindings when the dragged-in player was never individually customized for this console", () => {
    // A player can have no entry in this console's raw layout row (undefined)
    // while still effectively inheriting bindings from the standard profile -
    // that's exactly what getEffectiveConsoleLayout falls back to at launch.
    // Regression: without a profile fallback here, dragging that (apparently
    // empty) slot into player1 hit the "don't leave player1 empty" safety net
    // and silently kept player1's OWN old bindings unchanged.
    const layout = makeLayout();
    layout.player2 = undefined;
    const profile = makeProfile(); // profile.player2 = bindings("P2")

    const order = movePlayerSlot(1, 0); // drag (console-unconfigured) P2 onto P1
    const next = reorderConsoleLayoutPlayers(layout, order, profile);

    expect(next.player1?.face.primary).toEqual({ type: "key", code: "P2" });
  });

  it("still protects player1 from becoming empty when neither the layout nor the profile has that player configured", () => {
    const layout = makeLayout();
    layout.player2 = undefined;
    const profile = makeProfile();
    profile.player2 = undefined;

    const order = movePlayerSlot(1, 0);
    const next = reorderConsoleLayoutPlayers(layout, order, profile);

    expect(next.player1).toEqual(layout.player1);
  });
});
