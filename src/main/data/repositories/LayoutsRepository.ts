import { randomUUID } from "crypto";
import { JsonEditor } from "../../utils/editors/json";
import { createDefaultProfileShape } from "../../../shared/controls/layoutDefaults";
import { CONSOLE_CATALOG } from "../../../shared/emulators/catalog";
import type { ConsoleID } from "../../../shared/types";
import type { PlayerBindings } from "../../../shared/types/controls";
import { BaseRepository } from "./BaseRepository";

/** The per-player bindings stored in `bindings_json`. */
export type LayoutPlayers = {
  player1: PlayerBindings;
  player2?: PlayerBindings;
  player3?: PlayerBindings;
  player4?: PlayerBindings;
};

/** A console layout as it exists on disk, decoded but not yet merged. */
export interface StoredLayout {
  id: string;
  consoleId: ConsoleID;
  profileId: string;
  createdAt: number;
  updatedAt: number;
  isUserModified: boolean;
  controllerIds: Array<string | undefined>;
  players: LayoutPlayers;
}

/** Summary row, without the bindings blob. */
export interface StoredLayoutSummary {
  id: string;
  consoleId: ConsoleID;
  profileId: string;
  createdAt: number;
  updatedAt: number;
  isUserModified: boolean;
  controllerId?: string;
}

// schema stores one column per slot; callers deal in an array
function toControllerIds(row: Pick<LayoutRow, "controller_id" | "player2_controller_id" | "player3_controller_id" | "player4_controller_id">): Array<string | undefined> {
  return [
    row.controller_id || undefined,
    row.player2_controller_id || undefined,
    row.player3_controller_id || undefined,
    row.player4_controller_id || undefined,
  ];
}

interface LayoutRow {
  id: string;
  console_id: string;
  profile_id: string;
  created_at: number;
  updated_at: number;
  is_user_modified: number;
  controller_id: string | null;
  player2_controller_id: string | null;
  player3_controller_id: string | null;
  player4_controller_id: string | null;
  bindings_json: string;
}

function assertConsoleId(value: string): asserts value is ConsoleID {
  if (!(value in CONSOLE_CATALOG)) {
    throw new Error(`Invalid console_id in DB: ${value}`);
  }
}

export function parseBindings(text: string): LayoutPlayers {
  const parsed = JsonEditor.safeParse(text) as Partial<LayoutPlayers> | PlayerBindings | null;
  if (parsed && typeof parsed === "object") {
    if ("player1" in parsed && parsed.player1) return parsed as LayoutPlayers;
    return { player1: parsed as PlayerBindings };
  }
  return { player1: createDefaultProfileShape().player1 };
}

function serializeBindings(players: LayoutPlayers): string {
  return JsonEditor.stringify(players, 0, false);
}

function toStoredLayout(row: LayoutRow): StoredLayout {
  assertConsoleId(row.console_id);
  return {
    id: row.id,
    consoleId: row.console_id,
    profileId: row.profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isUserModified: row.is_user_modified === 1,
    controllerIds: toControllerIds(row),
    players: parseBindings(row.bindings_json),
  };
}

const COLUMNS = `id, console_id, profile_id, created_at, updated_at, is_user_modified,
                 controller_id, player2_controller_id, player3_controller_id,
                 player4_controller_id, bindings_json`;

/** Controller model per player slot, 0-based. */
export type LayoutControllerIds = Array<string | undefined>;

/** Every SQL statement touching `console_layouts`. */
export class LayoutsRepository extends BaseRepository {
  find(consoleId: ConsoleID, profileId: string): StoredLayout | null {
    const row = this.db
      .prepare(
        `select ${COLUMNS} from console_layouts
         where console_id = ? and profile_id = ? limit 1`
      )
      .get(consoleId, profileId) as LayoutRow | undefined;
    return row ? toStoredLayout(row) : null;
  }

  listForProfile(profileId: string): StoredLayoutSummary[] {
    const rows = this.db
      .prepare(
        `select id, console_id, profile_id, created_at, updated_at, is_user_modified, controller_id
         from console_layouts
         where profile_id = ?
         order by updated_at desc`
      )
      .all(profileId) as Array<Omit<LayoutRow, "bindings_json">>;

    return rows.map((row) => {
      assertConsoleId(row.console_id);
      return {
        id: row.id,
        consoleId: row.console_id,
        profileId: row.profile_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isUserModified: row.is_user_modified === 1,
        controllerId: row.controller_id || undefined,
      };
    });
  }

  /** Inserts a layout the user has customized. */
  insertUserModified(args: {
    consoleId: ConsoleID;
    profileId: string;
    players: LayoutPlayers;
    controllers: LayoutControllerIds;
    timestamp: number;
  }): void {
    this.db
      .prepare(
        `insert into console_layouts
         (id, console_id, profile_id, created_at, updated_at, is_user_modified,
          controller_id, player2_controller_id, player3_controller_id, player4_controller_id, bindings_json)
         values (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        args.consoleId,
        args.profileId,
        args.timestamp,
        args.timestamp,
        args.controllers[0] || null,
        args.controllers[1] || null,
        args.controllers[2] || null,
        args.controllers[3] || null,
        serializeBindings(args.players)
      );
  }

  /** Inserts the untouched default layout for a console. */
  insertDefault(args: {
    consoleId: ConsoleID;
    profileId: string;
    players: LayoutPlayers;
    timestamp: number;
  }): void {
    this.db
      .prepare(
        `insert into console_layouts
         (id, console_id, profile_id, created_at, updated_at, is_user_modified, controller_id, bindings_json)
         values (?, ?, ?, ?, ?, 0, NULL, ?)`
      )
      .run(
        randomUUID(),
        args.consoleId,
        args.profileId,
        args.timestamp,
        args.timestamp,
        serializeBindings(args.players)
      );
  }

  updateUserModified(args: {
    id: string;
    players: LayoutPlayers;
    controllers: LayoutControllerIds;
    timestamp: number;
  }): void {
    this.db
      .prepare(
        `update console_layouts
         set bindings_json = ?, updated_at = ?, is_user_modified = 1,
             controller_id = ?, player2_controller_id = ?,
             player3_controller_id = ?, player4_controller_id = ?
         where id = ?`
      )
      .run(
        serializeBindings(args.players),
        args.timestamp,
        args.controllers[0] || null,
        args.controllers[1] || null,
        args.controllers[2] || null,
        args.controllers[3] || null,
        args.id
      );
  }

  /** Restores defaults, clearing the user-modified flag. */
  resetToDefaults(id: string, players: LayoutPlayers, timestamp: number): void {
    this.db
      .prepare(
        `update console_layouts
         set bindings_json = ?, updated_at = ?, is_user_modified = 0
         where id = ?`
      )
      .run(serializeBindings(players), timestamp, id);
  }
}

export const layoutsRepository = new LayoutsRepository();
