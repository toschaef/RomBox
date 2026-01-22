export const schema = `CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  filePath TEXT NOT NULL,
  consoleId TEXT NOT NULL,
  engineId TEXT NOT NULL,
  coverImage TEXT,
  playtime_seconds INTEGER NOT NULL DEFAULT 0,
  last_played_at INTEGER
);

CREATE TABLE IF NOT EXISTS controller_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  profile_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_controller_profiles_default
  ON controller_profiles(is_default)
  WHERE is_default = 1;

CREATE TABLE IF NOT EXISTS console_layouts (
  id TEXT PRIMARY KEY NOT NULL,
  console_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_user_modified INTEGER NOT NULL DEFAULT 0,
  bindings_json TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_console_layouts_unique
  ON console_layouts(console_id, profile_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;