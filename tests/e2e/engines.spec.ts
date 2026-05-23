import { _electron as electron, test, expect } from '@playwright/test';
import findExecutable from './findExecutable';
import path from 'path';
import fs from 'fs';

test.describe('RomBox Engines E2E Suite', () => {
  let electronApp: any;
  let page: any;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-engines-userdata');

  test.beforeAll(async () => {
    if (fs.existsSync(tempUserDataDir)) {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempUserDataDir, { recursive: true });

    const executablePath = findExecutable();

    if (executablePath) {
      console.log(`[E2E-Engines] Executing E2E against production build: ${executablePath}`);
      electronApp = await electron.launch({
        executablePath,
        args: [`--user-data-dir=${tempUserDataDir}`, '--hidden-test-window']
      });
    } else {
      console.log('[E2E-Engines] Executing E2E against development build via electron-forge.');
      electronApp = await electron.launch({
        args: [
          path.join(__dirname, '../../'),
          `--user-data-dir=${tempUserDataDir}`,
          '--hidden-test-window'
        ]
      });
    }

    page = await electronApp.firstWindow();
    page.on('console', (msg: any) => console.log(`[Engines E2E Console] ${msg.text()}`));
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
      console.error('[E2E-Engines Teardown] Failed to clean up temp user data directory:', err);
    }
  });

  test('should handle engine installer UI with mock progress stubs', async () => {
    // Intercept engine IPC calls in the main process to mock installation progress
    await electronApp.evaluate(async (electronModule: any) => {
      const { ipcMain } = electronModule;

      ipcMain.removeHandler('engine:get');
      ipcMain.handle('engine:get', async () => {
        return [
          {
            engineId: 'mesen',
            name: 'Mesen',
            platform: 'darwin',
            status: 'not_installed',
            consoles: ['nes', 'snes'],
            needsBios: false,
            biosMissingRequired: [] as string[],
            biosMissingWarning: [] as string[]
          }
        ];
      });

      ipcMain.removeHandler('engine:install-engine');
      ipcMain.handle('engine:install-engine', async (event: any, engineId: any) => {
        const webContents = event.sender;
        
        setTimeout(() => {
          try {
            webContents.send('install-status-update', 'Downloading emulator files...');
          } catch (e) {}
        }, 50);

        setTimeout(() => {
          try {
            webContents.send('install-status-update', 'Extracting files to directory...');
          } catch (e) {}
        }, 200);

        setTimeout(() => {
          try {
            webContents.send('install-status-update', 'complete');
          } catch (e) {}
        }, 400);

        return { success: true };
      });
    });

    // 1. Navigate to Engines Page
    await page.waitForSelector('#root');
    const enginesLink = page.locator('nav >> text=Engines');
    await enginesLink.click();
    await expect(page.url()).toContain('/engines');

    // 2. Click "Install" on the Mesen engine card
    const installButton = page.locator('button >> text=Install').first();
    await expect(installButton).toBeVisible();
    await installButton.click();

    // 3. Verify that progress state messages appear sequentially on the UI
    const downloadingLabel = page.locator('text=Downloading emulator files...');
    await expect(downloadingLabel).toBeVisible({ timeout: 5000 });

    const extractingLabel = page.locator('text=Extracting files to directory...');
    await expect(extractingLabel).toBeVisible({ timeout: 5000 });

    // 4. Verify completion returns status to "Installed"
    const installedLabel = page.locator('text=Installed').first();
    await expect(installedLabel).toBeVisible({ timeout: 5000 });
  });
});
