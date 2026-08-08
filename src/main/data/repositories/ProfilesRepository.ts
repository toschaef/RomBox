import { randomUUID } from "crypto";
import { JsonEditor } from "../../utils/editors/json";
import { createDefaultProfileShape } from "../../../shared/controls/layoutDefaults";
import type { ControlsProfile, ControllerProfileMeta } from "../../../shared/types/controls";
import { BaseRepository } from "./BaseRepository";

interface ProfileRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  profile_json: string;
  is_default: number;
}

/** The JSON blob stored in `profile_json`. */
type ProfilePayload = Pick<
  ControlsProfile,
  "preferredDevice" | "player1" | "player2" | "player3" | "player4"
>;

function toProfile(row: ProfileRow): ControlsProfile {
  const parsed = JsonEditor.safeParse(row.profile_json);
  const base = createDefaultProfileShape();
  const stored = (typeof parsed === "object" && parsed !== null
    ? parsed
    : {}) as Partial<ControlsProfile>;

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDefault: row.is_default === 1,

    preferredDevice: stored.preferredDevice ?? base.preferredDevice,
    player1: stored.player1 ?? base.player1,
    player2: stored.player2,
    player3: stored.player3,
    player4: stored.player4,
  };
}

function toPayloadJson(profile: ProfilePayload): string {
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

const COLUMNS = "id, name, created_at, updated_at, profile_json, is_default";

export class ProfilesRepository extends BaseRepository {
  findDefaultId(): string | null {
    const row = this.db
      .prepare("select id from controller_profiles where is_default = 1 limit 1")
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  }

  findById(id: string): ControlsProfile | null {
    const row = this.db
      .prepare(`select ${COLUMNS} from controller_profiles where id = ?`)
      .get(id) as ProfileRow | undefined;
    return row ? toProfile(row) : null;
  }

  listMeta(): ControllerProfileMeta[] {
    const rows = this.db
      .prepare(
        `select id, name, created_at, updated_at, is_default
         from controller_profiles
         order by is_default desc, updated_at desc`
      )
      .all() as Array<Pick<ProfileRow, "id" | "name" | "created_at" | "updated_at" | "is_default">>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDefault: row.is_default === 1,
    }));
  }

  findMostRecentlyUpdatedId(): string | null {
    const row = this.db
      .prepare("select id from controller_profiles order by updated_at desc limit 1")
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  }

  isDefault(id: string): boolean | null {
    const row = this.db
      .prepare("select is_default from controller_profiles where id = ?")
      .get(id) as { is_default: number } | undefined;
    return row ? row.is_default === 1 : null;
  }

  /** Creates a profile, clearing any existing default when this one takes over. */
  insert(args: {
    name: string;
    payload: ProfilePayload;
    makeDefault: boolean;
    timestamp: number;
  }): string {
    const id = randomUUID();

    this.db.transaction(() => {
      if (args.makeDefault) {
        this.db.prepare("update controller_profiles set is_default = 0 where is_default = 1").run();
      }
      this.db
        .prepare(
          `insert into controller_profiles (id, name, created_at, updated_at, profile_json, is_default)
           values (?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          args.name,
          args.timestamp,
          args.timestamp,
          toPayloadJson(args.payload),
          args.makeDefault ? 1 : 0
        );
    })();

    return id;
  }

  rename(id: string, name: string, timestamp: number): boolean {
    return (
      this.db
        .prepare("update controller_profiles set name = ?, updated_at = ? where id = ?")
        .run(name, timestamp, id).changes > 0
    );
  }

  savePayload(id: string, payload: ProfilePayload, timestamp: number): boolean {
    return (
      this.db
        .prepare("update controller_profiles set profile_json = ?, updated_at = ? where id = ?")
        .run(toPayloadJson(payload), timestamp, id).changes > 0
    );
  }

  /** Makes `id` the sole default. Returns false when no such profile exists. */
  setDefault(id: string, timestamp: number): boolean {
    let updated = false;
    this.db.transaction(() => {
      this.db.prepare("update controller_profiles set is_default = 0 where is_default = 1").run();
      updated =
        this.db
          .prepare("update controller_profiles set is_default = 1, updated_at = ? where id = ?")
          .run(timestamp, id).changes > 0;
    })();
    return updated;
  }

  /** Removes the profile and every console layout belonging to it. */
  deleteWithLayouts(id: string): void {
    this.db.transaction(() => {
      this.db.prepare("delete from console_layouts where profile_id = ?").run(id);
      this.db.prepare("delete from controller_profiles where id = ?").run(id);
    })();
  }
}

export const profilesRepository = new ProfilesRepository();
