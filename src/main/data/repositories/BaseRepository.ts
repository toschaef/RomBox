import type Database from "better-sqlite3";
import { getDB } from "../db";

export abstract class BaseRepository {
  constructor(private readonly injected?: Database.Database) {}

  protected get db(): Database.Database {
    return this.injected ?? getDB();
  }
}
