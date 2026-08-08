import { ControlsService } from "../../../../src/main/services/ControlsService";
import { initDB, getDB } from "../../../../src/main/data/db";
import { createDefaultProfileShape } from "../../../../src/shared/controls/layoutDefaults";
import { movePlayerSlot, reorderConsoleLayoutPlayers } from "../../../../src/renderer/controls/reorderPlayers";
import { setConsoleDigital, clearConsoleDigital } from "../../../../src/renderer/controls/consolePath";
import type { PlayerBindings } from "../../../../src/shared/types/controls";

describe("ControlsService", () => {
  let service: ControlsService;

  beforeEach(() => {
    try {
      const db = getDB();
      db.prepare("DELETE FROM controller_profiles").run();
      db.prepare("DELETE FROM console_layouts").run();
    } catch {
      initDB();
      const db = getDB();
      db.prepare("DELETE FROM controller_profiles").run();
      db.prepare("DELETE FROM console_layouts").run();
    }
    service = new ControlsService();
  });

  it("should ensure a default profile is created if none exists", () => {
    const defaultId = service.ensureDefaultProfileExists();
    expect(defaultId).toBeDefined();

    const profiles = service.getProfiles();
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe(defaultId);
    expect(profiles[0].name).toBe("Default");
  });

  it("should retrieve default profile shape", () => {
    const profile = service.getDefaultProfile();
    expect(profile.name).toBe("Default");
    expect(profile.isDefault).toBe(true);
    expect(profile.player1).toEqual(createDefaultProfileShape().player1);
  });

  it("should support profile creation, renaming, and retrieval", () => {
    const profile = service.createProfile({ name: "Custom Gamepad" });
    expect(profile.id).toBeDefined();
    expect(profile.name).toBe("Custom Gamepad");
    expect(profile.isDefault).toBe(false);

    const renamed = service.renameProfile(profile.id, "Xbox Controller");
    expect(renamed.name).toBe("Xbox Controller");

    const fetched = service.getProfile(profile.id);
    expect(fetched.name).toBe("Xbox Controller");
  });

  it("should change default profiles and enforce unique constraint", () => {
    const defaultId = service.ensureDefaultProfileExists();
    const profile1 = service.createProfile({ name: "Profile 1" });

    service.setDefault(profile1.id);

    const fetched1 = service.getProfile(profile1.id);
    expect(fetched1.isDefault).toBe(true);

    const fetchedDefault = service.getProfile(defaultId);
    expect(fetchedDefault.isDefault).toBe(false);
  });

  it("should get and save console bindings layout", () => {
    const profile = service.getDefaultProfile();
    
    // Get layout (should automatically create if not found)
    const layout = service.getConsoleLayout("nes", profile.id);
    expect(layout.consoleId).toBe("nes");
    expect(layout.isUserModified).toBe(false);

    // Save customized layout
    const customBindings = {
      ...layout.player1,
      face: {
        ...layout.player1.face,
        primary: { type: "key" as const, code: "KeyZ" }
      }
    };
    
    const saved = service.saveConsoleLayout({
      consoleId: "nes",
      profileId: profile.id,
      player1: customBindings
    });

    expect(saved.isUserModified).toBe(true);
    expect(saved.player1.face?.primary).toEqual({ type: "key", code: "KeyZ" });
  });

  it("should persist a distinct controller model per player (Mario Kart Wii: P1 Classic, P2 Wii Remote + Nunchuk)", () => {
    const profile = service.getDefaultProfile();
    const layout = service.getConsoleLayout("wii", profile.id);

    const saved = service.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: layout.player1,
      player2: layout.player1,
      controllerIds: ["classic", "wiimote_nunchuk"],
    });

    expect(saved.controllerIds?.[0]).toBe("classic");
    expect(saved.controllerIds?.[1]).toBe("wiimote_nunchuk");
    expect(saved.controllerIds?.[2]).toBeUndefined();
    expect(saved.controllerIds?.[3]).toBeUndefined();

    // Reload from a fresh read to prove it round-trips through the DB, not just
    // the in-memory return value of saveConsoleLayout.
    const reloaded = service.getConsoleLayout("wii", profile.id);
    expect(reloaded.controllerIds?.[0]).toBe("classic");
    expect(reloaded.controllerIds?.[1]).toBe("wiimote_nunchuk");
  });

  it("should update one player's controller model without disturbing another's", () => {
    const profile = service.getDefaultProfile();
    const layout = service.getConsoleLayout("wii", profile.id);

    service.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: layout.player1,
      player2: layout.player1,
      controllerIds: ["classic", "wiimote_nunchuk"],
    });

    // Simulate switching to the P2 tab and picking a different controller,
    // the way Controls.tsx's per-player dropdown does.
    const updated = service.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: layout.player1,
      player2: layout.player1,
      controllerIds: ["classic", "wiimote_sideways"],
    });

    expect(updated.controllerIds?.[0]).toBe("classic");
    expect(updated.controllerIds?.[1]).toBe("wiimote_sideways");
  });

  it("keeps a player's inherited bindings when they get their first per-console override", async () => {
    // Regression: binding a single console-specific control for player 2 (the
    // Wii page is full of them - Wiimote A/B/1/2, Nunchuk C/Z) used to wipe
    // every other binding that player had. The renderer builds the override by
    // writing into an empty object (consolePath.setConsoleDigital), and the
    // moment `layout.player2` existed at all, getEffectiveConsoleLayout stopped
    // falling back to the standard profile - so player 2 launched with one
    // binding and nothing else, i.e. a dead controller.
    const profile = service.getDefaultProfile();
    service.saveProfile({ ...profile, player2: profile.player1 });

    const raw = service.getConsoleLayout("wii", profile.id);
    const partialPlayer2 = setConsoleDigital(
      raw as never,
      "player2",
      "special.wiimoteA",
      { type: "key", code: "KeyM" }
    ).player2 as PlayerBindings;

    // What the UI sends up: only the control that was just bound.
    expect(Object.keys(partialPlayer2)).toEqual(["special"]);

    service.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: raw.player1,
      player2: partialPlayer2,
    });

    const effective = await service.getEffectiveConsoleLayout("wii", profile.id);
    expect(effective.player2?.face?.primary).toEqual(profile.player1.face.primary);
    expect(effective.player2?.move).toEqual(profile.player1.move);
    expect(effective.player2?.system?.start).toEqual(profile.player1.system.start);
    // ...and the newly bound control is still applied on top.
    expect(effective.player2?.special).toMatchObject({ wiimoteA: { type: "key", code: "KeyM" } });
  });

  it("lets a later save clear a single binding once the player has an override", async () => {
    // The flip side of the seeding above: seeding must only happen the first
    // time a player's override is created, otherwise clearing a binding on the
    // console page would just resurrect it from the standard profile.
    const profile = service.getDefaultProfile();
    service.saveProfile({ ...profile, player2: profile.player1 });

    service.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: profile.player1,
      player2: { ...profile.player1, special: { type: "wii", wiimoteA: { type: "key", code: "KeyM" } } },
    });

    const stored = service.getConsoleLayout("wii", profile.id);
    const cleared = clearConsoleDigital(stored as never, "player2", "face.primary");

    service.saveConsoleLayout({
      consoleId: "wii",
      profileId: profile.id,
      player1: stored.player1,
      player2: cleared.player2 as PlayerBindings,
    });

    const effective = await service.getEffectiveConsoleLayout("wii", profile.id);
    expect(effective.player2?.face?.primary).toBeUndefined();
    expect(effective.player2?.face?.secondary).toEqual(profile.player1.face.secondary);
  });

  it("propagates a player1/player2 swap (drag-reorder in Console mode) all the way through to launch", async () => {
    const profile = service.getDefaultProfile();

    // Distinctly mark player1 vs player2 so a swap is unambiguous to detect,
    // and customize this console's layout (isUserModified = true) - matching
    // the real-world state after any prior per-console customization.
    const player1Marked = { ...profile.player1, face: { ...profile.player1.face, primary: { type: "key" as const, code: "KeyP1MARK" } } };
    const player2Marked = { ...profile.player1, face: { ...profile.player1.face, primary: { type: "key" as const, code: "KeyP2MARK" } } };

    service.saveConsoleLayout({
      consoleId: "gc",
      profileId: profile.id,
      player1: player1Marked,
      player2: player2Marked,
    });

    const before = service.getConsoleLayout("gc", profile.id);
    expect(before.isUserModified).toBe(true);

    // Drag player2 (index 1) into player1's slot (index 0), exactly like
    // Controls.tsx's console-mode reorder path.
    const order = movePlayerSlot(1, 0);
    const reordered = reorderConsoleLayoutPlayers(before, order);
    service.saveConsoleLayout({
      consoleId: "gc",
      profileId: profile.id,
      player1: reordered.player1,
      player2: reordered.player2,
      player3: reordered.player3,
      player4: reordered.player4,
      controllerIds: reordered.controllerIds,
    });

    // This is what DolphinConfigurator (and any other configurator) actually
    // reads at launch time - the swap must be visible here, not just in the
    // raw saved row.
    const effective = await service.getEffectiveConsoleLayout("gc", profile.id);
    expect(effective.player1.face.primary).toEqual({ type: "key", code: "KeyP2MARK" });
    expect(effective.player2?.face.primary).toEqual({ type: "key", code: "KeyP1MARK" });
  });

  it("should delete profile and fallback to another default profile", () => {
    const defaultId = service.ensureDefaultProfileExists();
    const profile1 = service.createProfile({ name: "To Delete", makeDefault: true });

    service.deleteProfile(profile1.id);

    const profiles = service.getProfiles();
    expect(profiles.some(p => p.id === profile1.id)).toBe(false);
    expect(profiles.some(p => p.id === defaultId)).toBe(true);
  });
});
