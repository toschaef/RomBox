import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { initDB, getDB } from '../../src/main/data/db';

describe('Database Integration', () => {
  const mockApp = app as jest.Mocked<typeof app>;
  let testUserDataPath: string;

  beforeAll(() => {
    // Setup a specific temporary userData directory for database integration tests
    testUserDataPath = path.resolve(__dirname, '../temp-db-userdata');
    mockApp.getPath.mockImplementation((name: string) => {
      if (name === 'userData') {
        return testUserDataPath;
      }
      return `/mock/${name}`;
    });

    if (fs.existsSync(testUserDataPath)) {
      fs.rmSync(testUserDataPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testUserDataPath, { recursive: true });
  });

  afterAll(() => {
    try {
      // Ensure DB connection is closed before removing directory
      const db = getDB();
      if (db) db.close();
    } catch (err) {
      // ignore
    }
    try {
      if (fs.existsSync(testUserDataPath)) {
        fs.rmSync(testUserDataPath, { recursive: true, force: true });
      }
    } catch (err) {
      // ignore
    }
  });

  it('should initialize database and verify that all tables are created', () => {
    // Should throw error before initialization
    expect(() => getDB()).toThrow('Uninitialized DB');

    // Run initialization
    initDB();

    const db = getDB();
    expect(db).toBeDefined();

    // Verify the tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('games');
    expect(tableNames).toContain('controller_profiles');
    expect(tableNames).toContain('console_layouts');
    expect(tableNames).toContain('settings');
  });

  it('should verify games table schema and handle game CRUD operations', () => {
    const db = getDB();

    // Create / Insert
    const insertStmt = db.prepare(`
      INSERT INTO games (id, title, filePath, consoleId, engineId, playtime_seconds, last_played_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run('mario-nes', 'Super Mario Bros.', '/roms/smb.nes', 'nes', 'mesen', 120, 1621234567);

    // Read / Query
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get('mario-nes') as any;
    expect(game).toBeDefined();
    expect(game.title).toBe('Super Mario Bros.');
    expect(game.filePath).toBe('/roms/smb.nes');
    expect(game.consoleId).toBe('nes');
    expect(game.engineId).toBe('mesen');
    expect(game.playtime_seconds).toBe(120);
    expect(game.last_played_at).toBe(1621234567);

    // Update
    db.prepare('UPDATE games SET playtime_seconds = ?, last_played_at = ? WHERE id = ?')
      .run(150, 1621239999, 'mario-nes');

    const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get('mario-nes') as any;
    expect(updatedGame.playtime_seconds).toBe(150);
    expect(updatedGame.last_played_at).toBe(1621239999);

    // Delete
    db.prepare('DELETE FROM games WHERE id = ?').run('mario-nes');
    const deletedGame = db.prepare('SELECT * FROM games WHERE id = ?').get('mario-nes');
    expect(deletedGame).toBeUndefined();
  });

  it('should handle controller profiles and enforce default uniqueness constraints', () => {
    const db = getDB();

    const insertProfile = db.prepare(`
      INSERT INTO controller_profiles (id, name, created_at, updated_at, profile_json, is_default)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Insert first profile as default
    insertProfile.run('prof-1', 'Xbox Controller', 1620000000, 1620000000, '{}', 1);

    // Try to insert second profile as default (should throw unique index error)
    expect(() => {
      insertProfile.run('prof-2', 'PS4 Controller', 1620000000, 1620000000, '{}', 1);
    }).toThrow();

    // Verify index allows non-default items
    insertProfile.run('prof-2', 'PS4 Controller', 1620000000, 1620000000, '{}', 0);
    insertProfile.run('prof-3', 'Switch Controller', 1620000000, 1620000000, '{}', 0);

    const defaultsCount = db.prepare('SELECT COUNT(*) as count FROM controller_profiles WHERE is_default = 1').get() as { count: number };
    expect(defaultsCount.count).toBe(1);
  });

  it('should handle key-value settings table read/writes', () => {
    const db = getDB();

    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('launch.fullscreen', 'true');
    insertSetting.run('launch.resolution', '1080');

    const resolutionSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('launch.resolution') as { value: string };
    expect(resolutionSetting.value).toBe('1080');

    const fullscreenSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('launch.fullscreen') as { value: string };
    expect(fullscreenSetting.value).toBe('true');
  });
});
