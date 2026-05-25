import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { SettingsPage } from './models/SettingsPage';

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

test.describe('RomBox Settings E2E Suite', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-settings-userdata');

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
      console.error('[E2E-Settings Teardown] Failed to clean up temp user data directory:', err);
    }
  });

  test('should handle fullscreen toggles, resolution scale, state persistency, and resets', async () => {
    const settingsPage = new SettingsPage(page);

    // 1. Navigate to Settings page
    await settingsPage.waitForRoot();
    await settingsPage.navigateToSettings();
    await expect(page.url()).toContain('/settings');

    // 2. Locate and check the fullscreen switch
    await expect(settingsPage.fullscreenSwitch).toBeVisible();
    
    // Toggle fullscreen to active
    await settingsPage.toggleFullscreen();
    await expect(settingsPage.fullscreenSwitch).toBeChecked();

    // 3. Locate and change the resolution dropdown
    await expect(settingsPage.resolutionSelect).toBeVisible();
    await settingsPage.selectResolution('1080'); // e.g. 1080p resolution

    // 4. Verify persistency: navigate to Library and back
    await settingsPage.navigateToLibrary();
    await settingsPage.navigateToSettings();

    // Expect values to persist
    await expect(settingsPage.fullscreenSwitch).toBeChecked();
    await expect(settingsPage.resolutionSelect).toHaveValue('1080');
  });
});
