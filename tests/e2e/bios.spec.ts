import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { BiosPage } from './models/BiosPage';

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

test.describe('RomBox Bios E2E Suite', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-bios-userdata');

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
      console.error('[E2E-Bios Teardown] Failed to clean up temp user data directory:', err);
    }
  });

  test('should handle BIOS drop and update status slots', async () => {
    const biosPage = new BiosPage(page);

    // 1. Navigate to Bios page
    await biosPage.waitForRoot();
    await biosPage.navigateToBios();
    await expect(page.url()).toContain('/bios');

    // 2. Create a dummy BIOS file inside our isolated temporary directory
    const dummyBiosPath = path.join(tempUserDataDir, 'scph5501.bin');
    fs.writeFileSync(dummyBiosPath, 'dummy PS1 BIOS file');

    // 3. Simulate drag and drop completely within browser context to preserve file path
    await biosPage.dragAndDropBios(dummyBiosPath, 'scph5501.bin');

    // 4. Verify the status changes (e.g. state should reflect warning/missing resolution update)
    const dropResultLabel = biosPage.getDropResultLabel('scph5501.bin');
    await expect(dropResultLabel).toBeVisible({ timeout: 15000 });
  });
});
