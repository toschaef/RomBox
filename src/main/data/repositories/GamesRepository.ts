import type { ConsoleID, Game } from "../../../shared/types";
import type { EngineID } from "../../../shared/types/engines";
import { BaseRepository } from "./BaseRepository";

/** A row of the `games` table, in its on-disk snake_case shape. */
interface GameRow {
  id: string;
  title: string;
  filePath: string;
  consoleId: string;
  engineId: string;
  coverImage?: string | null;
  playtime_seconds?: number;
  last_played_at?: number | null;
}

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    filePath: row.filePath,
    consoleId: row.consoleId as ConsoleID,
    engineId: row.engineId as EngineID,
    playtimeSeconds: row.playtime_seconds ?? 0,
    lastPlayedAt: row.last_played_at ?? null,
  } as Game;
}

export class GamesRepository extends BaseRepository {
  insert(game: Game): void {
    this.db
      .prepare(
        `insert into games (id, title, filePath, consoleId, engineId)
         values (@id, @title, @filePath, @consoleId, @engineId)`
      )
      .run({
        id: game.id,
        title: game.title,
        filePath: game.filePath,
        consoleId: game.consoleId,
        engineId: game.engineId,
      });
  }

  findAll(): Game[] {
    const rows = this.db.prepare("select * from games").all() as GameRow[];
    return rows.map(toGame);
  }

  findById(id: string): Game | null {
    const row = this.db.prepare("select * from games where id = @id").get({ id }) as
      | GameRow
      | undefined;
    return row ? toGame(row) : null;
  }

  /** Returns whether a row was actually updated. */
  updateTitleAndConsole(id: string, title: string, consoleId: ConsoleID): boolean {
    const result = this.db
      .prepare("update games set title = @title, consoleId = @consoleId where id = @id")
      .run({ id, title, consoleId });
    return result.changes > 0;
  }

  delete(id: string): boolean {
    return this.db.prepare("delete from games where id = ?").run(id).changes > 0;
  }

  deleteAll(): void {
    this.db.prepare("delete from games").run();
  }

  addPlaytime(id: string, seconds: number): boolean {
    const result = this.db
      .prepare("update games set playtime_seconds = playtime_seconds + ? where id = ?")
      .run(Math.floor(seconds), id);
    return result.changes > 0;
  }

  setLastPlayed(id: string, timestamp: number = Date.now()): boolean {
    const result = this.db
      .prepare("update games set last_played_at = ? where id = ?")
      .run(timestamp, id);
    return result.changes > 0;
  }
}

export const gamesRepository = new GamesRepository();
