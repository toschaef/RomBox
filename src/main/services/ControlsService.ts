import { randomUUID } from "crypto";
import { getDB } from "../data/db";
import type { ControlsProfile } from "../../shared/controls/types";
import { createDefaultProfileShape } from "../../shared/controls/types";

type RawRow = {
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

function rowToProfile(row: RawRow): ControlsProfile {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.profile_json);
  } catch {
    parsed = null;
  }

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
  };
}

function profileJson(profile: ControlsProfile): string {
  return JSON.stringify({
    preferredDevice: profile.preferredDevice,
    player1: profile.player1,
  });
}

export type ControllerProfileMeta = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  is_default: number;
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
      ).run(id, "Default", ts, ts, JSON.stringify(base));
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
      .get(id) as RawRow | undefined;

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
          return { preferredDevice: src.preferredDevice, player1: src.player1 };
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
      ).run(id, payload.name, ts, ts, JSON.stringify(basePayload), payload.makeDefault ? 1 : 0);
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

    db.prepare(`DELETE FROM controller_profiles WHERE id = ?`).run(id);

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
}