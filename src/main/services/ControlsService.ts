import { randomUUID } from "crypto";
import { getDB } from "../data/db";
import { JsonEditor } from "../utils/editors/json";
import type { ControlsProfile, ConsoleLayout, ControllerProfileMeta, PlayerBindings } from "../../shared/types/controls";
import type { ConsoleID } from "../../shared/types";
import { createDefaultProfileShape, makeDefaultConsoleBindings } from "../../shared/controls/layoutDefaults";

type RawProfileRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  profile_json: string;
  is_default: number;
};

function now() {
  return Date.now();
}

type RawLayoutRow = {
  id: string;
  console_id: string;
  profile_id: string;
  created_at: number;
  updated_at: number;
  is_user_modified: number;
  controller_id: string | null;
  bindings_json: string;
};

type LayoutPlayers = {
  player1: PlayerBindings;
  player2?: PlayerBindings;
  player3?: PlayerBindings;
  player4?: PlayerBindings;
};

function safeParseBindingsJson(text: string): LayoutPlayers {
  const parsed = JsonEditor.safeParse(text) as any;
  if (parsed && typeof parsed === "object") {
    if (parsed.player1) return parsed as LayoutPlayers;
    return { player1: parsed as PlayerBindings };
  }
  return { player1: createDefaultProfileShape().player1 };
}

function bindingsJson(players: LayoutPlayers): string {
  return JsonEditor.stringify(players, 0, false);
}

const ALL_CONSOLE_IDS: ConsoleID[] = [
  "nes",
  "snes",
  "gb",
  "gba",
  "gg",
  "sms",
  "pce",
  "n64",
  "ds",
  "3ds",
  "gc",
  "wii",
  "ps1",
  "ps2",
];

function assertConsoleID(x: string): asserts x is ConsoleID {
  if (!ALL_CONSOLE_IDS.includes(x as ConsoleID)) {
    throw new Error(`Invalid console_id in DB: ${x}`);
  }
}

function rowToProfile(row: RawProfileRow): ControlsProfile {
  const parsed = JsonEditor.safeParse(row.profile_json);

  const base = createDefaultProfileShape();
  const p = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Partial<ControlsProfile>;

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDefault: row.is_default === 1,

    preferredDevice: p.preferredDevice ?? base.preferredDevice,
    player1: p.player1 ?? base.player1,
    player2: p.player2,
    player3: p.player3,
    player4: p.player4,
  };
}

function profileJson(profile: ControlsProfile): string {
  return JsonEditor.stringify(
    {
      preferredDevice: profile.preferredDevice,
      player1: profile.player1,
      player2: profile.player2,
      player3: profile.player3,
      player4: profile.player4,
    },
    0,
    false
  );
}

export type ConsoleLayoutMeta = {
  id: string;
  console_id: ConsoleID;
  profile_id: string;
  created_at: number;
  updated_at: number;
  is_user_modified: number;
  controller_id?: string;
};

export class ControlsService {
  ensureDefaultProfileExists(): string {
    const db = getDB();

    const row = db
      .prepare(`SELECT id FROM controller_profiles WHERE is_default = 1 LIMIT 1`)
      .get() as { id: string } | undefined;

    if (row?.id) return row.id;

    const id = randomUUID();
    const ts = now();
    const base = createDefaultProfileShape();

    db.transaction(() => {
      db.prepare(`UPDATE controller_profiles SET is_default = 0 WHERE is_default = 1`).run();

      db.prepare(
        `INSERT INTO controller_profiles
         (id, name, created_at, updated_at, profile_json, is_default)
         VALUES (?, ?, ?, ?, ?, 1)`
      ).run(id, "Default", ts, ts, JsonEditor.stringify(base, 0, false));
    })();

    return id;
  }

  getProfiles(): ControllerProfileMeta[] {
    const db = getDB();
    this.ensureDefaultProfileExists();

    return db
      .prepare(
        `SELECT id, name, created_at, updated_at, is_default
         FROM controller_profiles
         ORDER BY is_default DESC, updated_at DESC`
      )
      .all() as ControllerProfileMeta[];
  }

  getProfile(id: string): ControlsProfile {
    const db = getDB();

    const row = db
      .prepare(
        `SELECT id, name, created_at, updated_at, profile_json, is_default
         FROM controller_profiles
         WHERE id = ?`
      )
      .get(id) as RawProfileRow | undefined;

    if (!row) throw new Error(`Profile not found: ${id}`);
    return rowToProfile(row);
  }

  getDefaultProfile(): ControlsProfile {
    const db = getDB();
    this.ensureDefaultProfileExists();

    const row = db
      .prepare(`SELECT id FROM controller_profiles WHERE is_default = 1 LIMIT 1`)
      .get() as { id: string } | undefined;

    if (!row?.id) throw new Error("Default profile could not be found or created.");
    return this.getProfile(row.id);
  }

  createProfile(payload: { name: string; copyFromId?: string; makeDefault?: boolean }): ControlsProfile {
    const db = getDB();
    const id = randomUUID();
    const ts = now();

    const basePayload = payload.copyFromId
      ? (() => {
        const src = this.getProfile(payload.copyFromId);
        return { 
          preferredDevice: src.preferredDevice, 
          player1: src.player1,
          player2: src.player2,
          player3: src.player3,
          player4: src.player4,
        };
      })()
      : createDefaultProfileShape();

    db.transaction(() => {
      if (payload.makeDefault) {
        db.prepare(`UPDATE controller_profiles SET is_default = 0 WHERE is_default = 1`).run();
      }

      db.prepare(
        `INSERT INTO controller_profiles
         (id, name, created_at, updated_at, profile_json, is_default)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, payload.name, ts, ts, JsonEditor.stringify(basePayload, 0, false), payload.makeDefault ? 1 : 0);
    })();

    return this.getProfile(id);
  }

  renameProfile(id: string, name: string): ControlsProfile {
    const db = getDB();
    const res = db.prepare(`UPDATE controller_profiles SET name = ?, updated_at = ? WHERE id = ?`).run(name, now(), id);
    if (res.changes === 0) throw new Error(`Profile not found: ${id}`);
    return this.getProfile(id);
  }

  setDefault(id: string): ControlsProfile {
    const db = getDB();

    db.transaction(() => {
      db.prepare(`UPDATE controller_profiles SET is_default = 0 WHERE is_default = 1`).run();
      const res = db.prepare(`UPDATE controller_profiles SET is_default = 1, updated_at = ? WHERE id = ?`).run(now(), id);
      if (res.changes === 0) throw new Error(`Profile not found: ${id}`);
    })();

    return this.getProfile(id);
  }

  deleteProfile(id: string): { ok: true } {
    const db = getDB();

    const row = db.prepare(`SELECT is_default FROM controller_profiles WHERE id = ?`).get(id) as
      | { is_default: number }
      | undefined;

    if (!row) throw new Error(`Profile not found: ${id}`);

    db.transaction(() => {
      db.prepare(`DELETE FROM console_layouts WHERE profile_id = ?`).run(id);
      db.prepare(`DELETE FROM controller_profiles WHERE id = ?`).run(id);
    })();

    if (row.is_default === 1) {
      const next = db.prepare(`SELECT id FROM controller_profiles ORDER BY updated_at DESC LIMIT 1`).get() as
        | { id: string }
        | undefined;

      if (next?.id) this.setDefault(next.id);
      else this.ensureDefaultProfileExists();
    }

    return { ok: true };
  }

  saveProfile(profile: ControlsProfile): ControlsProfile {
    const db = getDB();

    const res = db
      .prepare(`UPDATE controller_profiles SET profile_json = ?, updated_at = ? WHERE id = ?`)
      .run(profileJson(profile), now(), profile.id);

    if (res.changes === 0) throw new Error(`Profile not found: ${profile.id}`);
    return this.getProfile(profile.id);
  }

  getConsoleLayout<C extends ConsoleID>(consoleId: C, profileId: string): ConsoleLayout<C> {
    const db = getDB();

    const row = db
      .prepare(
        `SELECT id, console_id, profile_id, created_at, updated_at, is_user_modified, controller_id, bindings_json
        FROM console_layouts
        WHERE console_id = ? AND profile_id = ?
        LIMIT 1`
      )
      .get(consoleId, profileId) as RawLayoutRow | undefined;

    if (!row) {
      return this.createDefaultConsoleLayout(consoleId, this.getProfile(profileId));
    }

    assertConsoleID(row.console_id);

    const parsed = safeParseBindingsJson(row.bindings_json);

    return {
      id: row.id,
      consoleId,
      profileId: row.profile_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isUserModified: row.is_user_modified === 1,
      controllerId: row.controller_id || undefined,
      player1: parsed.player1,
      player2: parsed.player2,
      player3: parsed.player3,
      player4: parsed.player4,
    };
  }

  saveConsoleLayout(args: { consoleId: ConsoleID; profileId: string; player1: PlayerBindings; player2?: PlayerBindings; player3?: PlayerBindings; player4?: PlayerBindings; controllerId?: string }): ConsoleLayout {
    const db = getDB();
    this.getProfile(args.profileId);

    const existing = db
      .prepare(`SELECT id FROM console_layouts WHERE console_id = ? AND profile_id = ? LIMIT 1`)
      .get(args.consoleId, args.profileId) as { id: string } | undefined;

    const ts = now();
    
    const players: LayoutPlayers = {
      player1: args.player1,
      player2: args.player2,
      player3: args.player3,
      player4: args.player4,
    };

    if (!existing?.id) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO console_layouts
        (id, console_id, profile_id, created_at, updated_at, is_user_modified, controller_id, bindings_json)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(id, args.consoleId, args.profileId, ts, ts, args.controllerId || null, bindingsJson(players));

      return this.getConsoleLayout(args.consoleId, args.profileId);
    }

    db.prepare(
      `UPDATE console_layouts
      SET bindings_json = ?, updated_at = ?, is_user_modified = 1, controller_id = ?
      WHERE id = ?`
    ).run(bindingsJson(players), ts, args.controllerId || null, existing.id);

    return this.getConsoleLayout(args.consoleId, args.profileId);
  }

  resetConsoleLayout(consoleId: ConsoleID, profileId: string): ConsoleLayout {
    const db = getDB();
    const profile = this.getProfile(profileId);

    const defaultP1: PlayerBindings = makeDefaultConsoleBindings(consoleId, profile);
    const defaults: LayoutPlayers = { player1: defaultP1 };
    
    const ts = now();

    const existing = db
      .prepare(`SELECT id FROM console_layouts WHERE console_id = ? AND profile_id = ? LIMIT 1`)
      .get(consoleId, profileId) as { id: string } | undefined;

    if (!existing?.id) {
      return this.createDefaultConsoleLayout(consoleId, profile);
    }

    db.prepare(
      `UPDATE console_layouts
      SET bindings_json = ?, updated_at = ?, is_user_modified = 0
      WHERE id = ?`
    ).run(bindingsJson(defaults), ts, existing.id);

    return this.getConsoleLayout(consoleId, profileId);
  }

  getConsoleLayouts(profileId: string): ConsoleLayoutMeta[] {
    const db = getDB();
    this.getProfile(profileId);

    const rows = db
      .prepare(
        `SELECT id, console_id, profile_id, created_at, updated_at, is_user_modified, controller_id
        FROM console_layouts
        WHERE profile_id = ?
        ORDER BY updated_at DESC`
      )
      .all(profileId) as Array<{
        id: string;
        console_id: string;
        profile_id: string;
        created_at: number;
        updated_at: number;
        is_user_modified: number;
        controller_id: string | null;
      }>;

    return rows.map((r) => {
      assertConsoleID(r.console_id);
      return {
        id: r.id,
        console_id: r.console_id as ConsoleID,
        profile_id: r.profile_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        is_user_modified: r.is_user_modified,
        controller_id: r.controller_id || undefined,
      };
    });
  }

  private createDefaultConsoleLayout<C extends ConsoleID>(consoleId: C, profile: ControlsProfile): ConsoleLayout<C> {
    const db = getDB();

    const id = randomUUID();
    const ts = now();
    const defaultP1: PlayerBindings = makeDefaultConsoleBindings(consoleId, profile);
    const defaults: LayoutPlayers = { player1: defaultP1 };

    db.prepare(
      `INSERT INTO console_layouts
      (id, console_id, profile_id, created_at, updated_at, is_user_modified, controller_id, bindings_json)
      VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`
    ).run(id, consoleId, profile.id, ts, ts, bindingsJson(defaults));

    return this.getConsoleLayout(consoleId, profile.id);
  }

  async getEffectiveConsoleLayout(consoleId: ConsoleID, profileId: string): Promise<ConsoleLayout> {
    const profile = this.getProfile(profileId);
    const layout = this.getConsoleLayout(consoleId, profileId);
    
    if (!layout.isUserModified) {
      return {
        ...layout,
        player1: makeDefaultConsoleBindings(consoleId, profile),
        player2: profile.player2,
        player3: profile.player3,
        player4: profile.player4,
      };
    }

    return {
      ...layout,
      player1: layout.player1 ?? profile.player1,
      player2: layout.player2 ?? profile.player2,
      player3: layout.player3 ?? profile.player3,
      player4: layout.player4 ?? profile.player4,
    };
  }
}