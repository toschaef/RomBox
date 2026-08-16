// the whole point of referencing roms instead of copying them: the file can
// move out from under the library, and the user has to be able to fix it.
import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import findExecutable from './findExecutable';
import { LibraryPage } from './models/LibraryPage';

const NES_HEADER = 'NES\x1a\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00';

test.describe('RomBox Game Relocation E2E Suite', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let libraryPage: LibraryPage;

  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-relocate-userdata');
  // deliberately outside userData: this stands in for the user's own rom folder
  const gamesDir = path.join(__dirname, '../../temp-e2e-relocate-games');

  const originalRomPath = path.join(gamesDir, 'moving-game.nes');
  const movedRomPath = path.join(gamesDir, 'moved', 'moving-game.nes');

  test.beforeAll(async () => {
    for (const dir of [tempUserDataDir, gamesDir]) {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(originalRomPath, NES_HEADER);

    const executablePath = findExecutable();
    electronApp = executablePath
      ? await electron.launch({
          executablePath,
          args: [`--user-data-dir=${tempUserDataDir}`, '--hidden-test-window'],
        })
      : await electron.launch({
          args: [
            path.resolve(__dirname, '../../'),
            `--user-data-dir=${tempUserDataDir}`,
            '--hidden-test-window',
          ],
        });

    page = await electronApp.firstWindow();
    libraryPage = new LibraryPage(page);
    await libraryPage.waitForRoot();

    // no emulator is installed in this run, so launching is stubbed out; the
    // missing-file handling under test happens before any launch is attempted
    await electronApp.evaluate(async (electronModule: unknown) => {
      const { ipcMain } = electronModule as typeof import('electron');
      ipcMain.removeHandler('game:launch');
      ipcMain.handle('game:launch', async () => ({ success: true }));
    });
  });

  test.afterAll(async () => {
    if (electronApp) await electronApp.close();
    for (const dir of [tempUserDataDir, gamesDir]) {
      try {
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        console.error('[E2E-Relocate Teardown] Failed to clean up', dir, err);
      }
    }
  });

  test('imports a game by reference without copying it into the library', async () => {
    await libraryPage.dragAndDropRom(originalRomPath, 'moving-game.nes');

    await expect(libraryPage.getGameCard('moving-game')).toBeVisible({ timeout: 15000 });

    // the rom is recorded where it already lives - nothing is duplicated
    const romsDir = path.join(tempUserDataDir, 'roms');
    const copied = fs.existsSync(romsDir)
      ? fs.readdirSync(romsDir, { recursive: true } as { recursive: true }) as string[]
      : [];
    expect(copied.filter((f) => String(f).endsWith('.nes'))).toEqual([]);
    expect(fs.existsSync(originalRomPath)).toBe(true);
  });

  test('flags the game as missing once its file is moved', async () => {
    fs.mkdirSync(path.dirname(movedRomPath), { recursive: true });
    fs.renameSync(originalRomPath, movedRomPath);

    await libraryPage.refresh();

    await expect(page.getByTestId('game-missing-badge').first()).toBeVisible({ timeout: 15000 });
  });

  test('prompts to update the path and plays again once relocated', async () => {
    // clicking a game whose file is gone asks where it went
    await libraryPage.getGameCard('moving-game').click();
    await expect(page.getByTestId('locate-game-modal')).toBeVisible();
    await expect(page.getByTestId('locate-game-modal')).toContainText('moving-game.nes');

    // stand in for the user picking the new location in the native dialog
    await electronApp.evaluate(async (electronModule: unknown, { newPath }) => {
      const { dialog } = electronModule as typeof import('electron');
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [newPath],
      })) as typeof dialog.showOpenDialog;
    }, { newPath: movedRomPath });

    await page.getByTestId('locate-game-button').click();

    await expect(page.getByTestId('locate-game-modal')).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('game-missing-badge')).toHaveCount(0);

    // and the card launches again instead of re-prompting
    const launched = new Promise<void>((resolve) => {
      page.on('console', (msg) => {
        if (msg.text().includes('Game launched without electron error')) resolve();
      });
    });

    await libraryPage.getGameCard('moving-game').click();
    await expect(launched).resolves.toBeUndefined();
  });

  test('keeps the relocated file on disk when the game is deleted', async () => {
    await libraryPage.openGameMenu();
    await libraryPage.deleteGameFromMenu();

    await expect(libraryPage.getGameCard('moving-game')).toHaveCount(0, { timeout: 15000 });
    // the library only referenced this file - it is the user's, not rombox's
    expect(fs.existsSync(movedRomPath)).toBe(true);
  });
});
