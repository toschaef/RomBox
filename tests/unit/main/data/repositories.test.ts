// better-sqlite3 is mocked repo-wide, so `new Database(":memory:")` yields
// the fake from tests/__mocks__. enough for mapping and transactions, not a
// test of sqlite semantics. see docs/testing.md
import Database from "better-sqlite3";
import { GamesRepository } from "../../../../src/main/data/repositories/GamesRepository";
import { SettingsRepository } from "../../../../src/main/data/repositories/SettingsRepository";
import { ProfilesRepository } from "../../../../src/main/data/repositories/ProfilesRepository";
import { LayoutsRepository, parseBindings } from "../../../../src/main/data/repositories/LayoutsRepository";
import { createDefaultProfileShape } from "../../../../src/shared/controls/layoutDefaults";
import type { Game } from "../../../../src/shared/types";

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "game-1",
    title: "Test Game",
    filePath: "/roms/nes/Test Game.nes",
    consoleId: "nes",
    engineId: "mesen",
    playtimeSeconds: 0,
    lastPlayedAt: null,
    ...overrides,
  } as Game;
}

describe("GamesRepository", () => {
  let db: Database.Database;
  let repo: GamesRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    repo = new GamesRepository(db);
  });

  it("round-trips a game, exposing camelCase rather than column names", () => {
    repo.insert(makeGame());

    const game = repo.findById("game-1");
    expect(game).toMatchObject({
      id: "game-1",
      title: "Test Game",
      consoleId: "nes",
      engineId: "mesen",
      playtimeSeconds: 0,
      lastPlayedAt: null,
    });
    expect(game).not.toHaveProperty("playtime_seconds");
    expect(game).not.toHaveProperty("last_played_at");
  });

  it("returns null for a game that does not exist", () => {
    expect(repo.findById("nope")).toBeNull();
  });

  it("accumulates playtime rather than overwriting it", () => {
    repo.insert(makeGame());

    repo.addPlaytime("game-1", 30);
    repo.addPlaytime("game-1", 12.7);

    // fractional seconds are floored on the way in.
    expect(repo.findById("game-1")?.playtimeSeconds).toBe(42);
  });

  it("reports whether an update matched a row", () => {
    repo.insert(makeGame());

    expect(repo.addPlaytime("missing", 10)).toBe(false);
    expect(repo.setLastPlayed("missing")).toBe(false);
    expect(repo.updateTitleAndConsole("missing", "x", "nes")).toBe(false);

    expect(repo.setLastPlayed("game-1", 1234)).toBe(true);
    expect(repo.findById("game-1")?.lastPlayedAt).toBe(1234);
  });

  it("updates title and console together", () => {
    repo.insert(makeGame());
    expect(repo.updateTitleAndConsole("game-1", "Renamed", "snes")).toBe(true);

    const game = repo.findById("game-1");
    expect(game?.title).toBe("Renamed");
    expect(game?.consoleId).toBe("snes");
  });

  it("updates only the file path, leaving the rest of the row alone", () => {
    repo.insert(makeGame());
    repo.addPlaytime("game-1", 60);

    expect(repo.updateFilePath("game-1", "/elsewhere/Test Game.nes")).toBe(true);
    expect(repo.updateFilePath("missing", "/elsewhere/x.nes")).toBe(false);

    const game = repo.findById("game-1");
    expect(game?.filePath).toBe("/elsewhere/Test Game.nes");
    expect(game?.title).toBe("Test Game");
    expect(game?.playtimeSeconds).toBe(60);
  });

  it("deletes one game and all games", () => {
    repo.insert(makeGame());
    repo.insert(makeGame({ id: "game-2", filePath: "/roms/nes/Other.nes" }));

    expect(repo.delete("game-1")).toBe(true);
    expect(repo.delete("game-1")).toBe(false);
    expect(repo.findAll()).toHaveLength(1);

    repo.deleteAll();
    expect(repo.findAll()).toEqual([]);
  });
});

describe("SettingsRepository", () => {
  let db: Database.Database;
  let repo: SettingsRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    repo = new SettingsRepository(db);
  });

  it("stores values as JSON text", () => {
    repo.set("launch.fullscreen", true);
    expect(repo.getRaw("launch.fullscreen")).toBe("true");
  });

  it("returns null for an unset key", () => {
    expect(repo.getRaw("nothing.here")).toBeNull();
  });

  it("does not overwrite an existing value when seeding defaults", () => {
    repo.set("launch.fullscreen", false);
    repo.insertDefaults({ "launch.fullscreen": true, "ui.fullscreen": true });

    expect(repo.getRaw("launch.fullscreen")).toBe("false");
    expect(repo.getRaw("ui.fullscreen")).toBe("true");
  });

  it("writes many values in one transaction", () => {
    repo.setMany([
      ["launch.fullscreen", true],
      ["launch.resolution", 2],
    ]);

    expect(repo.getRaw("launch.fullscreen")).toBe("true");
    expect(repo.getRaw("launch.resolution")).toBe("2");
  });
});

describe("ProfilesRepository", () => {
  let db: Database.Database;
  let repo: ProfilesRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    repo = new ProfilesRepository(db);
  });

  function insertProfile(name: string, makeDefault = false): string {
    return repo.insert({
      name,
      payload: createDefaultProfileShape(),
      makeDefault,
      timestamp: Date.now(),
    });
  }

  it("decodes profile_json into a domain profile", () => {
    const id = insertProfile("Default", true);

    const profile = repo.findById(id);
    expect(profile).toMatchObject({ id, name: "Default", isDefault: true });
    expect(profile?.player1).toBeDefined();
    expect(profile).not.toHaveProperty("profile_json");
  });

  it("keeps exactly one default when a new default is inserted", () => {
    const first = insertProfile("First", true);
    const second = insertProfile("Second", true);

    expect(repo.findDefaultId()).toBe(second);
    expect(repo.isDefault(first)).toBe(false);
  });

  it("moves the default without leaving two behind", () => {
    const first = insertProfile("First", true);
    const second = insertProfile("Second");

    expect(repo.setDefault(second, Date.now())).toBe(true);
    expect(repo.findDefaultId()).toBe(second);
    expect(repo.isDefault(first)).toBe(false);
  });

  it("distinguishes a missing profile from a non-default one", () => {
    const id = insertProfile("Only");
    expect(repo.isDefault(id)).toBe(false);
    expect(repo.isDefault("missing")).toBeNull();
  });

  it("reports whether rename and save matched a row", () => {
    const id = insertProfile("Original");

    expect(repo.rename("missing", "x", Date.now())).toBe(false);
    expect(repo.rename(id, "Renamed", Date.now())).toBe(true);
    expect(repo.findById(id)?.name).toBe("Renamed");

    expect(repo.savePayload("missing", createDefaultProfileShape(), Date.now())).toBe(false);
    expect(repo.savePayload(id, createDefaultProfileShape(), Date.now())).toBe(true);
  });

  it("deletes a profile together with its console layouts", () => {
    const id = insertProfile("Doomed", true);
    const layouts = new LayoutsRepository(db);
    layouts.insertDefault({
      consoleId: "nes",
      profileId: id,
      players: { player1: createDefaultProfileShape().player1 },
      timestamp: Date.now(),
    });

    repo.deleteWithLayouts(id);

    expect(repo.findById(id)).toBeNull();
    expect(layouts.listForProfile(id)).toEqual([]);
  });
});

describe("LayoutsRepository", () => {
  let db: Database.Database;
  let repo: LayoutsRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    repo = new LayoutsRepository(db);
  });

  const players = () => ({ player1: createDefaultProfileShape().player1 });

  it("marks a default layout as not user-modified", () => {
    repo.insertDefault({
      consoleId: "nes",
      profileId: "p1",
      players: players(),
      timestamp: 100,
    });

    const layout = repo.find("nes", "p1");
    expect(layout?.isUserModified).toBe(false);
    expect(layout?.controllerIds?.[0]).toBeUndefined();
    expect(layout?.consoleId).toBe("nes");
  });

  it("stores and reads back per-player controller ids", () => {
    repo.insertUserModified({
      consoleId: "gc",
      profileId: "p1",
      players: players(),
      controllers: ["gamecube", "wiimote"],
      timestamp: 100,
    });

    const layout = repo.find("gc", "p1");
    expect(layout?.isUserModified).toBe(true);
    expect(layout?.controllerIds?.[0]).toBe("gamecube");
    expect(layout?.controllerIds?.[1]).toBe("wiimote");
    // empty columns surface as undefined, not empty strings.
    expect(layout?.controllerIds?.[2]).toBeUndefined();
  });

  it("clears the user-modified flag on reset", () => {
    repo.insertUserModified({
      consoleId: "nes",
      profileId: "p1",
      players: players(),
      controllers: ["nes"],
      timestamp: 100,
    });

    const before = repo.find("nes", "p1");
    expect(before).not.toBeNull();
    repo.resetToDefaults(before?.id ?? "", players(), 200);

    const after = repo.find("nes", "p1");
    expect(after?.isUserModified).toBe(false);
    expect(after?.updatedAt).toBe(200);
  });

  it("returns null for a console with no layout", () => {
    expect(repo.find("wii", "p1")).toBeNull();
  });

  it("lists a profile's layouts most-recent first", () => {
    repo.insertDefault({ consoleId: "nes", profileId: "p1", players: players(), timestamp: 100 });
    repo.insertDefault({ consoleId: "snes", profileId: "p1", players: players(), timestamp: 300 });
    repo.insertDefault({ consoleId: "gb", profileId: "p2", players: players(), timestamp: 200 });

    expect(repo.listForProfile("p1").map((l) => l.consoleId)).toEqual(["snes", "nes"]);
  });

  it("rejects a console id the catalog does not know", () => {
    db.prepare(
      `insert into console_layouts
       (id, console_id, profile_id, created_at, updated_at, is_user_modified, bindings_json)
       values ('x', 'dreamcast', 'p1', 1, 1, 0, '{}')`
    ).run();

    expect(() => repo.find("dreamcast" as never, "p1")).toThrow(/Invalid console_id/);
  });
});

describe("parseBindings", () => {
  it("accepts the keyed multi-player shape", () => {
    const players = { player1: createDefaultProfileShape().player1 };
    expect(parseBindings(JSON.stringify(players)).player1).toEqual(players.player1);
  });

  it("accepts the legacy bare-bindings shape", () => {
    // layouts written before multi-player support stored player 1 directly.
    const legacy = createDefaultProfileShape().player1;
    expect(parseBindings(JSON.stringify(legacy)).player1).toEqual(legacy);
  });

  it("falls back to defaults on unparseable json", () => {
    expect(parseBindings("not json").player1).toBeDefined();
  });
});
