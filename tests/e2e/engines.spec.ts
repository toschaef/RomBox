import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';
import findExecutable from './findExecutable';
import path from 'path';
import fs from 'fs';
import { EnginesPage } from './models/EnginesPage';

test.describe('RomBox Engines E2E Suite', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-engines-userdata');

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
      console.error('[E2E-Engines Teardown] Failed to clean up temp user data directory:', err);
    }
  });

  test('should handle engine installer UI with mock progress stubs', async () => {
    const enginesPage = new EnginesPage(page);

    // Intercept engine IPC calls in the main process to mock installation progress
    await electronApp.evaluate(async (electronModule: unknown) => {
      const { ipcMain } = electronModule as typeof import('electron');

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
      ipcMain.handle('engine:install-engine', async (event: unknown) => {
        const webContents = (event as { sender: { send: (channel: string, message: string) => void } }).sender;
        
        setTimeout(() => {
          try {
            webContents.send('install-status-update', 'Downloading emulator files...');
          } catch (e) { /* ignore */ }
        }, 50);

        setTimeout(() => {
          try {
            webContents.send('install-status-update', 'Extracting files to directory...');
          } catch (e) { /* ignore */ }
        }, 200);

        setTimeout(() => {
          try {
            webContents.send('install-status-update', 'complete');
          } catch (e) { /* ignore */ }
        }, 400);

        return { success: true };
      });
    });

    // 1. Navigate to Engines Page
    await enginesPage.waitForRoot();
    await enginesPage.navigateToEngines();
    await expect(page.url()).toContain('/engines');

    // 2. Click "Install" on the Mesen engine card
    const installButton = enginesPage.getInstallButton('Mesen');
    await expect(installButton).toBeVisible();
    await enginesPage.installEngine('Mesen');

    // 3. Verify that progress state messages appear sequentially on the UI
    await expect(enginesPage.downloadingLabel).toBeVisible({ timeout: 5000 });
    await expect(enginesPage.extractingLabel).toBeVisible({ timeout: 5000 });

    // 4. Verify completion returns status to "Installed"
    await expect(enginesPage.installedLabel).toBeVisible({ timeout: 5000 });
  });
});
