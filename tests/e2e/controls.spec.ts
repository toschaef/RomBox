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

test.describe('RomBox Controls E2E Suite', () => {
  let electronApp: any;
  let page: any;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-controls-userdata');

  test.beforeAll(async () => {
    if (fs.existsSync(tempUserDataDir)) {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempUserDataDir, { recursive: true });

    const executablePath = findExecutable();

    if (executablePath) {
      console.log(`[E2E-Controls] Executing E2E against production build: ${executablePath}`);
      electronApp = await electron.launch({
        executablePath,
        args: [`--user-data-dir=${tempUserDataDir}`, '--hidden-test-window']
      });
    } else {
      console.log('[E2E-Controls] Executing E2E against development build via electron-forge.');
      electronApp = await electron.launch({
        args: [
          path.join(__dirname, '../../'),
          `--user-data-dir=${tempUserDataDir}`,
          '--hidden-test-window'
        ]
      });
    }

    page = await electronApp.firstWindow();
    page.on('console', (msg: any) => console.log(`[Controls E2E Console] ${msg.text()}`));
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
    // 1. Navigate to Controls Page
    await page.waitForSelector('#root');
    const controlsLink = page.locator('nav >> text=Controls');
    await controlsLink.click();
    await expect(page.url()).toContain('/controls');

    // 2. Perform profile creation
    const newProfileButton = page.locator('button[title="New Profile"]');
    await expect(newProfileButton).toBeVisible();
    await newProfileButton.click();

    // Fill profile name in modal input
    const nameInput = page.locator('input[placeholder="Profile Name"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('E2E Profile');

    const saveButton = page.locator('button >> text=Save');
    await saveButton.click();

    // 3. Verify profile is added and can be selected
    const select = page.locator('select');
    await expect(select).toBeVisible();
    await select.selectOption({ label: 'E2E Profile' });

    // 4. Map control bindings (remapping)
    const cardA = page.locator('.relative.w-full.p-4').filter({ has: page.locator('span:text-is("A")') }).first();
    await expect(cardA).toBeVisible();
    await cardA.click();

    // Verify it enters the listening state
    const listeningText = cardA.locator('text=Press input');
    await expect(listeningText).toBeVisible();

    // Wait 500ms to satisfy startedAt threshold and press X
    await page.waitForTimeout(500);
    await page.keyboard.press('x');

    // Verify listening state ends and the bound key is visible
    await expect(listeningText).not.toBeVisible();
    const boundText = cardA.locator('text=X');
    await expect(boundText).toBeVisible();
  });
});
