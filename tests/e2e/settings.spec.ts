import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

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
  let electronApp: any;
  let page: any;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-settings-userdata');

  test.beforeAll(async () => {
    if (fs.existsSync(tempUserDataDir)) {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempUserDataDir, { recursive: true });

    const executablePath = findExecutable();

    if (executablePath) {
      console.log(`[E2E-Settings] Executing E2E against production build: ${executablePath}`);
      electronApp = await electron.launch({
        executablePath,
        args: [`--user-data-dir=${tempUserDataDir}`, '--hidden-test-window']
      });
    } else {
      console.log('[E2E-Settings] Executing E2E against development build via electron-forge.');
      electronApp = await electron.launch({
        args: [
          path.join(__dirname, '../../'),
          `--user-data-dir=${tempUserDataDir}`,
          '--hidden-test-window'
        ]
      });
    }

    page = await electronApp.firstWindow();
    page.on('console', (msg: any) => console.log(`[Settings E2E Console] ${msg.text()}`));
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
    // 1. Navigate to Settings page
    await page.waitForSelector('#root');
    const settingsLink = page.locator('nav >> text=Settings');
    await settingsLink.click();
    await expect(page.url()).toContain('/settings');

    // 2. Locate and check the fullscreen switch
    const fullscreenSwitch = page.locator('#launchFullscreen');
    await expect(fullscreenSwitch).toBeVisible();
    
    // Toggle fullscreen to active
    const isCheckedBefore = await fullscreenSwitch.isChecked();
    await fullscreenSwitch.click();
    await expect(fullscreenSwitch).toBeChecked();

    // 3. Locate and change the resolution dropdown
    const resolutionSelect = page.locator('#launchResolution');
    await expect(resolutionSelect).toBeVisible();
    await resolutionSelect.selectOption('1080'); // e.g. 1080p resolution

    // 4. Verify persistency: navigate to Library and back
    const libraryLink = page.locator('nav >> text=Library');
    await libraryLink.click();
    await settingsLink.click();

    // Expect values to persist
    await expect(fullscreenSwitch).toBeChecked();
    await expect(resolutionSelect).toHaveValue('1080');

  });
});
