import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { LibraryPage } from './models/LibraryPage';
import findExecutable from './findExecutable';

// save export and import both go through native dialogs, which are stubbed in
// the main process per test. the assertions are on real files on disk.
test.describe('RomBox Saves E2E Suite', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let userDataDir: string;

  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-saves-userdata');
  const scratch = path.join(tempUserDataDir, 'scratch');

  const GAME_TITLE = 'save-test-game';
  const ROM_NAME = `${GAME_TITLE}.nes`;

  /** a valid iNES rom header, enough for the scanner to identify it */
  const NES_HEADER = 'NES\x1a\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00';

  /** battery saves must be a power-of-two chip size between 512b and 1mb */
  const validSave = (fill = 0xa5) => Buffer.alloc(8192, fill);

  function cacheDir() {
    return path.join(userDataDir, 'saves', 'nes');
  }

  // --user-data-dir does not redirect the emulator's own save directory, so
  // imports land in the real Mesen folder. ask the app where that is and only
  // ever touch files belonging to the test game.
  async function emulatorSaveDir(): Promise<string> {
    return page.evaluate(async (title: string) => {
      const bridge = (window as unknown as {
        electron: { invoke: (channel: string, payload?: unknown) => Promise<never> };
      }).electron;

      const games = (await bridge.invoke('game:getAll')) as unknown as {
        games: Array<{ id: string; title: string }>;
      };
      const game = games.games.find((g) => g.title === title);
      if (!game) return '';

      const status = (await bridge.invoke('save:status', { gameId: game.id })) as unknown as {
        status?: { emulatorSaveDir?: string };
      };
      return status.status?.emulatorSaveDir ?? '';
    }, GAME_TITLE);
  }

  async function clearTestGameSaves() {
    fs.rmSync(cacheDir(), { recursive: true, force: true });

    const emuDir = await emulatorSaveDir();
    if (!emuDir || !fs.existsSync(emuDir)) return;
    for (const entry of fs.readdirSync(emuDir)) {
      if (entry.startsWith(`${GAME_TITLE}.`)) {
        fs.rmSync(path.join(emuDir, entry), { force: true });
      }
    }
  }

  /** seeds a cached save, which is what export reads from */
  function seedCachedSave(contents: Buffer) {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(path.join(cacheDir(), `${GAME_TITLE}.sav`), contents);
  }

  async function stubSaveDialog(filePath: string | null) {
    await electronApp.evaluate(async (electronModule: unknown, chosen) => {
      const { dialog } = electronModule as typeof import('electron');
      dialog.showSaveDialog = async () =>
        chosen === null
          ? ({ canceled: true, filePath: undefined } as never)
          : ({ canceled: false, filePath: chosen } as never);
    }, filePath);
  }

  async function stubOpenDialog(filePath: string | null) {
    await electronApp.evaluate(async (electronModule: unknown, chosen) => {
      const { dialog } = electronModule as typeof import('electron');
      dialog.showOpenDialog = async () =>
        chosen === null
          ? ({ canceled: true, filePaths: [] } as never)
          : ({ canceled: false, filePaths: [chosen] } as never);
    }, filePath);
  }

  async function openSaveMenu() {
    const libraryPage = new LibraryPage(page);
    await libraryPage.search(GAME_TITLE);
    await expect(libraryPage.getGameCard(GAME_TITLE)).toBeVisible({ timeout: 15000 });
    await page.getByTestId('game-menu-button').first().click();
  }

  test.beforeAll(async () => {
    fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    fs.mkdirSync(scratch, { recursive: true });

    const executablePath = findExecutable();
    electronApp = executablePath
      ? await electron.launch({
          executablePath,
          args: [`--user-data-dir=${tempUserDataDir}`, '--hidden-test-window'],
        })
      : await electron.launch({
          args: [
            path.join(__dirname, '../../'),
            `--user-data-dir=${tempUserDataDir}`,
            '--hidden-test-window',
          ],
        });

    page = await electronApp.firstWindow();

    // ask the app where it actually keeps userData rather than assuming
    userDataDir = await electronApp.evaluate(async (electronModule: unknown) => {
      const { app } = electronModule as typeof import('electron');
      return app.getPath('userData');
    });

    // import one game that every test operates on
    const romPath = path.join(scratch, ROM_NAME);
    fs.writeFileSync(romPath, NES_HEADER);

    await electronApp.evaluate(async (electronModule: unknown, { testPath }) => {
      const { ipcMain } = electronModule as typeof import('electron');
      ipcMain.removeHandler('select-files-or-directories');
      ipcMain.handle('select-files-or-directories', async () => [testPath]);
    }, { testPath: romPath });

    const libraryPage = new LibraryPage(page);
    await libraryPage.search('');
    await libraryPage.clickManualImport();
    await expect(libraryPage.getGameCard(GAME_TITLE)).toBeVisible({ timeout: 20000 });
  });

  test.afterAll(async () => {
    // leave no trace in the user's real emulator save directory
    try {
      await clearTestGameSaves();
    } catch (err) {
      console.error('[E2E-Saves Teardown] Failed to clean emulator saves:', err);
    }

    if (electronApp) await electronApp.close();
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    } catch (err) {
      console.error('[E2E-Saves Teardown] Failed to clean up temp user data directory:', err);
    }
  });

  test.beforeEach(async () => {
    await clearTestGameSaves();
  });

  test('should export a cached save to the chosen path', async () => {
    const contents = validSave(0x11);
    seedCachedSave(contents);

    const dest = path.join(scratch, 'exported.sav');
    await stubSaveDialog(dest);

    await openSaveMenu();
    await page.getByTestId('export-save').click();

    await expect(
      page.getByText(`${GAME_TITLE} save data exported`).first()
    ).toBeVisible({ timeout: 15000 });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest).equals(contents)).toBe(true);
  });

  test('should write nothing when the export dialog is cancelled', async () => {
    seedCachedSave(validSave());
    const dest = path.join(scratch, 'cancelled.sav');
    await stubSaveDialog(null);

    await openSaveMenu();
    await page.getByTestId('export-save').click();

    // no toast either way, so give the handler time to settle before asserting
    await page.waitForTimeout(1500);
    expect(fs.existsSync(dest)).toBe(false);
  });

  test('should report an error when there is nothing to export', async () => {
    // cacheDir was cleared and no save was seeded
    await stubSaveDialog(path.join(scratch, 'never-written.sav'));

    await openSaveMenu();
    await page.getByTestId('export-save').click();

    await expect(
      page.getByText(`Error exporting ${GAME_TITLE} save data`).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('should import a valid save and name it after the rom', async () => {
    const source = path.join(scratch, 'incoming.sav');
    fs.writeFileSync(source, validSave(0x22));
    await stubOpenDialog(source);

    await openSaveMenu();
    await page.getByTestId('import-save').click();

    await expect(
      page.getByText(`1 save file imported for ${GAME_TITLE}`).first()
    ).toBeVisible({ timeout: 15000 });

    // per-game saves are installed under the rom's basename, not the source name
    const installed = path.join(cacheDir(), `${GAME_TITLE}.sav`);
    expect(fs.existsSync(installed)).toBe(true);
    expect(fs.readFileSync(installed).equals(validSave(0x22))).toBe(true);
  });

  test('should reject a file that is not a real save', async () => {
    // 100 bytes is not a valid cartridge chip size
    const bogus = path.join(scratch, 'bogus.sav');
    fs.writeFileSync(bogus, Buffer.alloc(100, 1));
    await stubOpenDialog(bogus);

    await openSaveMenu();
    await page.getByTestId('import-save').click();

    await expect(page.getByText(/Save not imported/).first()).toBeVisible({ timeout: 15000 });
    expect(fs.existsSync(path.join(cacheDir(), `${GAME_TITLE}.sav`))).toBe(false);
  });

  test('should write nothing when the import dialog is cancelled', async () => {
    await stubOpenDialog(null);

    await openSaveMenu();
    await page.getByTestId('import-save').click();

    await page.waitForTimeout(1500);
    expect(fs.existsSync(path.join(cacheDir(), `${GAME_TITLE}.sav`))).toBe(false);
  });

  test('should round trip an exported save back through import', async () => {
    const original = validSave(0x33);
    seedCachedSave(original);

    const exported = path.join(scratch, 'roundtrip.sav');
    await stubSaveDialog(exported);

    await openSaveMenu();
    await page.getByTestId('export-save').click();
    await expect(
      page.getByText(`${GAME_TITLE} save data exported`).first()
    ).toBeVisible({ timeout: 15000 });

    // wipe the cache, then import what was just exported
    fs.rmSync(cacheDir(), { recursive: true, force: true });
    await stubOpenDialog(exported);

    await openSaveMenu();
    await page.getByTestId('import-save').click();
    await expect(
      page.getByText(new RegExp(`imported for ${GAME_TITLE}`)).first()
    ).toBeVisible({ timeout: 15000 });

    const restored = path.join(cacheDir(), `${GAME_TITLE}.sav`);
    expect(fs.existsSync(restored)).toBe(true);
    expect(fs.readFileSync(restored).equals(original)).toBe(true);
  });

  test('should export several saves as a zip', async () => {
    // a savestate alongside the battery save makes the export multi-file
    seedCachedSave(validSave(0x44));
    const statesDir = path.join(cacheDir(), 'savestates');
    fs.mkdirSync(statesDir, { recursive: true });
    fs.writeFileSync(path.join(statesDir, `${GAME_TITLE}_1.mss`), Buffer.alloc(64, 9));

    const dest = path.join(scratch, 'bundle.zip');
    await stubSaveDialog(dest);

    await openSaveMenu();
    await page.getByTestId('export-save').click();

    await expect(
      page.getByText(`${GAME_TITLE} save data exported`).first()
    ).toBeVisible({ timeout: 15000 });
    expect(fs.existsSync(dest)).toBe(true);

    const names = new AdmZip(dest).getEntries().map((e) => e.entryName);
    expect(names.length).toBeGreaterThan(1);
    expect(names.some((n) => n.endsWith('.sav'))).toBe(true);
    expect(names.some((n) => n.endsWith('.mss'))).toBe(true);
  });
});
