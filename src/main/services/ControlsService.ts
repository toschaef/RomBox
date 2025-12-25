import { randomUUID } from "crypto";
import { getDB } from "../data/db";
import type { ActionBindings, PhysicalBinding, LogicalAction } from "../../shared/types/controls";

interface RawControllerProfile {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  bindings: string; // stored as json
  device_hint: string | null;
  layout: string | null;
  is_default: number;
}

function now() {
  return Date.now();
}

function createEmptyBindings(): ActionBindings {
  return {
    MOVE_UP: [],
    MOVE_DOWN: [],
    MOVE_LEFT: [],
    MOVE_RIGHT: [],
    FACE_PRIMARY: [],
    FACE_SECONDARY: [],
    FACE_TERTIARY: [],
    FACE_QUATERNARY: [],
    BUMPER_L: [],
    BUMPER_R: [],
    TRIGGER_L: [],
    TRIGGER_R: [],
    START: [],
    SELECT: [],
  };
}

function isPhysicalBinding(item: unknown): item is PhysicalBinding {
  if (!item || typeof item !== "object") return false;
  const rec = item as Record<string, unknown>;
  return (
    (rec.device === "keyboard" || rec.device === "gamepad") &&
    typeof rec.input === "string"
  );
}

function mergeWithDefaults(saved: unknown): ActionBindings {
  const defaults = createEmptyBindings();
  if (!saved || typeof saved !== "object") return defaults;

  const obj = saved as Record<string, unknown>;
  const merged: ActionBindings = { ...defaults };

  (Object.keys(defaults) as LogicalAction[]).forEach((key) => {
    const v = obj[key];
    if (Array.isArray(v)) {
      merged[key] = v.filter(isPhysicalBinding);
    }
  });

  return merged;
}

export type ControllerProfileMeta = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  device_hint: string | null;
  layout: string | null;
  is_default: number;
};

export type ControllerProfile = ControllerProfileMeta & {
  bindings: ActionBindings;
};

export class ControlsService {
  ensureDefaultProfileExists(): string {
    const db = getDB();

    const row = db
      .prepare(`SELECT id FROM controller_profiles WHERE is_default = 1 LIMIT 1`)
      .get() as { id: string } | undefined;

    if (row) return row.id;

    const id = randomUUID();
    const ts = now();

    db.transaction(() => {
      db.prepare(`UPDATE controller_profiles SET is_default = 0 WHERE is_default = 1`).run();

      db.prepare(
        `INSERT INTO controller_profiles
         (id, name, created_at, updated_at, bindings, device_hint, layout, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(id, "Default", ts, ts, JSON.stringify(createEmptyBindings()), null, null);
    })();

    return id;
  }

  getProfiles(): ControllerProfileMeta[] {
    const db = getDB();
    this.ensureDefaultProfileExists();

    return db
      .prepare(
        `SELECT id, name, created_at, updated_at, device_hint, layout, is_default
         FROM controller_profiles
         ORDER BY is_default DESC, updated_at DESC`
      )
      .all() as ControllerProfileMeta[];
  }

  getProfile(id: string): ControllerProfile {
    const db = getDB();

    const row = db
      .prepare(
        `SELECT id, name, created_at, updated_at, bindings, device_hint, layout, is_default
         FROM controller_profiles
         WHERE id = ?`
      )
      .get(id) as RawControllerProfile | undefined;

    if (!row) throw new Error(`Profile not found: ${id}`);

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(row.bindings);
    } catch {
      parsed = null;
    }

    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      device_hint: row.device_hint ?? null,
      layout: row.layout ?? null,
      is_default: row.is_default ?? 0,
      bindings: mergeWithDefaults(parsed),
    };
  }

  getDefaultProfile(): ControllerProfile {
    const db = getDB();
    this.ensureDefaultProfileExists();

    const row = db
      .prepare(`SELECT id FROM controller_profiles WHERE is_default = 1 LIMIT 1`)
      .get() as { id: string } | undefined;

    if (!row) {
      throw new Error("Default profile could not be found or created.");
    }

    return this.getProfile(row.id);
  }

  createProfile(payload: {
    name: string;
    copyFromId?: string;
    makeDefault?: boolean;
    device_hint?: string | null;
    layout?: string | null;
  }): ControllerProfile {
    const db = getDB();
    const id = randomUUID();
    const ts = now();

    const baseBindings = payload.copyFromId
      ? this.getProfile(payload.copyFromId).bindings
      : createEmptyBindings();

    db.transaction(() => {
      if (payload.makeDefault) {
        db.prepare(`UPDATE controller_profiles SET is_default = 0 WHERE is_default = 1`).run();
      }

      db.prepare(
        `INSERT INTO controller_profiles
         (id, name, created_at, updated_at, bindings, device_hint, layout, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        payload.name,
        ts,
        ts,
        JSON.stringify(baseBindings),
        payload.device_hint ?? null,
        payload.layout ?? null,
        payload.makeDefault ? 1 : 0
      );
    })();

    return this.getProfile(id);
  }

  renameProfile(id: string, name: string): ControllerProfile {
    const db = getDB();
    const res = db
      .prepare(`UPDATE controller_profiles SET name = ?, updated_at = ? WHERE id = ?`)
      .run(name, now(), id);

    if (res.changes === 0) throw new Error(`Profile not found: ${id}`);
    return this.getProfile(id);
  }

  setDefault(id: string): ControllerProfile {
    const db = getDB();

    db.transaction(() => {
      db.prepare(`UPDATE controller_profiles SET is_default = 0 WHERE is_default = 1`).run();
      const res = db
        .prepare(`UPDATE controller_profiles SET is_default = 1, updated_at = ? WHERE id = ?`)
        .run(now(), id);

      if (res.changes === 0) throw new Error(`Profile not found: ${id}`);
    })();

    return this.getProfile(id);
  }

  deleteProfile(id: string): { ok: true } {
    const db = getDB();

    const row = db
      .prepare(`SELECT is_default FROM controller_profiles WHERE id = ?`)
      .get(id) as { is_default: number } | undefined;

    if (!row) throw new Error(`Profile not found: ${id}`);

    db.prepare(`DELETE FROM controller_profiles WHERE id = ?`).run(id);

    if (row.is_default === 1) {
      const next = db
        .prepare(`SELECT id FROM controller_profiles ORDER BY updated_at DESC LIMIT 1`)
        .get() as { id: string } | undefined;

      if (next?.id) this.setDefault(next.id);
      else this.ensureDefaultProfileExists();
    }

    return { ok: true };
  }

  saveBindings(profileId: string, bindings: ActionBindings): ControllerProfile {
    const db = getDB();
    const merged = mergeWithDefaults(bindings);

    const res = db
      .prepare(`UPDATE controller_profiles SET bindings = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(merged), now(), profileId);

    if (res.changes === 0) throw new Error(`Profile not found: ${profileId}`);
    return this.getProfile(profileId);
  }

  bindAction(profileId: string, action: LogicalAction, input: PhysicalBinding): ControllerProfile {
    const profile = this.getProfile(profileId);
    const current = profile.bindings[action] ?? [];

    if (current.some((b) => b.device === input.device && b.input === input.input)) {
      return profile;
    }

    const next: ActionBindings = { ...profile.bindings, [action]: [...current, input] };
    return this.saveBindings(profileId, next);
  }

  clearAction(profileId: string, action: LogicalAction): ControllerProfile {
    const profile = this.getProfile(profileId);
    const next: ActionBindings = { ...profile.bindings, [action]: [] };
    return this.saveBindings(profileId, next);
  }

  resetAll(profileId: string): ControllerProfile {
    return this.saveBindings(profileId, createEmptyBindings());
  }
}