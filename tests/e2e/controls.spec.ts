import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { ControlsPage } from './models/ControlsPage';

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

test.describe('RomBox Controls E2E Suite', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-controls-userdata');

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
      console.error('[E2E-Controls Teardown] Failed to clean up temp user data directory:', err);
    }
  });

  test('should support controls page remapping and profile management', async () => {
    const controlsPage = new ControlsPage(page);

    // 1. Navigate to Controls Page
    await controlsPage.waitForRoot();
    await controlsPage.navigateToControls();
    await expect(page.url()).toContain('/controls');

    // 2. Perform profile creation
    await expect(controlsPage.newProfileButton).toBeVisible();
    await controlsPage.createProfile('E2E Profile');

    // 3. Verify profile is added and can be selected
    await expect(controlsPage.profileSelect).toBeVisible();
    await controlsPage.selectProfile('E2E Profile');

    // 4. Map control bindings (remapping)
    const cardA = controlsPage.getControlCard('A');
    await expect(cardA).toBeVisible();
    await cardA.click();

    // Verify it enters the listening state
    const listeningText = cardA.getByText('Press input');
    await expect(listeningText).toBeVisible();

    // Wait 500ms to satisfy startedAt threshold and press X
    await page.waitForTimeout(500);
    await page.keyboard.press('x');

    // Verify listening state ends and the bound key is visible
    await expect(listeningText).not.toBeVisible();
    const boundText = cardA.getByText('X', { exact: true });
    await expect(boundText).toBeVisible();
  });
});
