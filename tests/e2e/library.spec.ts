import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

function findExecutable(): string {
  if (!process.env.TEST_PACKAGED) {
    return '';
  }
  const outDir = path.join(__dirname, '../../out');
  if (fs.existsSync(outDir)) {
    const folders = fs.readdirSync(outDir);
    for (const folder of folders) {
      if (folder.startsWith('rombox-darwin-')) {
        const appPath = path.join(outDir, folder, 'rombox.app/Contents/MacOS/rombox');
        if (fs.existsSync(appPath)) {
          return appPath;
        }
      }
    }
  }
  return '';
}

test.describe('RomBox Library E2E Suite', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-library-userdata');

  test.beforeAll(async () => {
    if (fs.existsSync(tempUserDataDir)) {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempUserDataDir, { recursive: true });

    const executablePath = findExecutable();

    if (executablePath) {
      electronApp = await electron.launch({
        executablePath,
        args: [`--user-data-dir=${tempUserDataDir}`, '--hidden-test-window']
      });
    } else {
      electronApp = await electron.launch({
        args: [
          path.join(__dirname, '../../'),
          `--user-data-dir=${tempUserDataDir}`,
          '--hidden-test-window'
        ]
      });
    }

    page = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    try {
      if (fs.existsSync(tempUserDataDir)) {
        fs.rmSync(tempUserDataDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('[E2E-Library Teardown] Failed to clean up temp user data directory:', err);
    }
  });

  test('should verify sidebar links and load library grid successfully', async () => {
    await page.waitForSelector('#root');
    const brand = page.locator('aside >> text=RomBox');
    await expect(brand).toBeVisible();

    const libraryLink = page.locator('nav >> text=Library');
    await expect(libraryLink).toBeVisible();
  });

  test('should handle ROM drag and drop, search, and click-to-play launch', async () => {
    // 1. Mock the game:launch IPC handler in the main process
    await electronApp.evaluate(async (electronModule: unknown) => {
      const { ipcMain } = electronModule as typeof import('electron');
      ipcMain.removeHandler('game:launch');
      ipcMain.handle('game:launch', async () => {
        return { success: true };
      });
    });

    // 2. Create a dummy NES rom file inside our isolated temporary directory
    const dummyRomPath = path.join(tempUserDataDir, 'mock-game.nes');
    fs.writeFileSync(dummyRomPath, 'NES\x1a\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00');

    // 3. Set up a promise that resolves when the expected console log appears
    const launchConsolePromise = new Promise<void>((resolve) => {
      page.on('console', (msg) => {
        if (msg.text().includes('Game launched without electron error')) {
          resolve();
        }
      });
    });

    // 4. Simulate ROM drag and drop completely within browser context to preserve file path
    await page.evaluate(({ fullPath }: { fullPath: string }) => {
      const element = document.getElementById('root')?.firstElementChild || document.querySelector('#root');
      if (!element) throw new Error('Root element not found');

      Object.defineProperty(DragEvent.prototype, 'dataTransfer', {
        get() { return (this as unknown as { _mockDataTransfer?: unknown })._mockDataTransfer || null; },
        configurable: true
      });

      const file = Object.create(File.prototype);
      Object.defineProperty(file, 'name', { value: 'mock-game.nes', enumerable: true });
      Object.defineProperty(file, 'size', { value: 16, enumerable: true });
      Object.defineProperty(file, 'type', { value: 'application/octet-stream', enumerable: true });
      Object.defineProperty(file, 'path', { value: fullPath, enumerable: true, configurable: true });

      const mockDataTransfer = {
        files: Object.assign([file], { item: () => file }),
        types: ['Files'],
        getData: () => '',
        setData: () => ''
      };

      const event = new DragEvent('drop', {
        bubbles: true,
        cancelable: true
      });
      (event as unknown as { _mockDataTransfer: unknown })._mockDataTransfer = mockDataTransfer;

      element.dispatchEvent(event);
    }, { fullPath: dummyRomPath });

    // 5. Verify the game shows up in the library grid
    const gameCard = page.locator('h3 >> text=mock-game').first();
    await expect(gameCard).toBeVisible({ timeout: 15000 });

    // 6. Test search bar filtering
    const searchBar = page.locator('input[placeholder*="Search"]');
    await searchBar.fill('non-existent-game-query');
    await expect(gameCard).not.toBeVisible();

    await searchBar.fill('mock-game');
    await expect(gameCard).toBeVisible();

    // 7. Click the game card to trigger launch
    await gameCard.click();
    await expect(launchConsolePromise).resolves.toBeUndefined();
  });

  test('should handle manual file and directory upload via native dialog', async () => {
    // 1. Create a dummy NES ROM file inside our isolated temporary directory
    const manualRomPath = path.join(tempUserDataDir, 'manual-game.nes');
    fs.writeFileSync(manualRomPath, 'NES\x1a\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00');

    // 2. Clear search bar to ensure new imports are not filtered out
    const searchBar = page.locator('input[placeholder*="Search"]');
    if (await searchBar.isVisible()) {
      await searchBar.fill('');
    }

    // 3. Mock the select-files-or-directories IPC handler in the main process
    await electronApp.evaluate(async (electronModule: unknown, { testPath }) => {
      const { ipcMain } = electronModule as typeof import('electron');
      ipcMain.removeHandler('select-files-or-directories');
      ipcMain.handle('select-files-or-directories', async () => {
        return [testPath];
      });
    }, { testPath: manualRomPath });

    // 4. Click the manual import button to trigger selection and import
    await page.locator('#manual-import-button').click();

    // 5. Verify the game shows up in the library grid
    const gameCard = page.locator('h3 >> text=manual-game').first();
    await expect(gameCard).toBeVisible({ timeout: 15000 });
  });

  test('should handle supported zip archive drag and drop', async () => {
    // 1. Create a valid zip archive inside our isolated temporary directory
    const zip = new AdmZip();
    zip.addFile('zipped-game.nes', Buffer.from('NES\x1a\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00'));
    const zipPath = path.join(tempUserDataDir, 'archive-game.zip');
    zip.writeZip(zipPath);

    // 2. Clear search bar first to ensure it's visible
    const searchBar = page.locator('input[placeholder*="Search"]');
    if (await searchBar.isVisible()) {
      await searchBar.fill('');
    }

    // 3. Simulate supported zip archive drag and drop completely within browser context
    await page.evaluate(({ fullPath }: { fullPath: string }) => {
      const element = document.getElementById('root')?.firstElementChild || document.querySelector('#root');
      if (!element) throw new Error('Root element not found');

      Object.defineProperty(DragEvent.prototype, 'dataTransfer', {
        get() { return (this as unknown as { _mockDataTransfer?: unknown })._mockDataTransfer || null; },
        configurable: true
      });

      const file = Object.create(File.prototype);
      Object.defineProperty(file, 'name', { value: 'archive-game.zip', enumerable: true });
      Object.defineProperty(file, 'size', { value: 100, enumerable: true });
      Object.defineProperty(file, 'type', { value: 'application/zip', enumerable: true });
      Object.defineProperty(file, 'path', { value: fullPath, enumerable: true, configurable: true });

      const mockDataTransfer = {
        files: Object.assign([file], { item: () => file }),
        types: ['Files'],
        getData: () => '',
        setData: () => ''
      };

      const event = new DragEvent('drop', {
        bubbles: true,
        cancelable: true
      });
      (event as unknown as { _mockDataTransfer: unknown })._mockDataTransfer = mockDataTransfer;

      element.dispatchEvent(event);
    }, { fullPath: zipPath });

    // 4. Verify the game shows up in the library grid as "zipped-game"
    const gameCard = page.locator('h3 >> text=zipped-game').first();
    await expect(gameCard).toBeVisible({ timeout: 15000 });
  });
});
