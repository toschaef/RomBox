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

  test('should successfully install all available emulators', async () => {
    test.setTimeout(600000); // 10 minutes timeout for all downloads

    const enginesPage = new EnginesPage(page);

    // 1. Navigate to Engines Page
    await enginesPage.waitForRoot();
    await enginesPage.navigateToEngines();
    await expect(page.url()).toContain('/engines');

    // Wait for the UI to populate the engines list
    await expect(page.locator('text=Mesen 2')).toBeVisible({ timeout: 15000 });

    const enginesToTest = [
      'Mesen 2',
      'MelonDS',
      'Azahar',
      'Dolphin',
      'Ares',
      'DuckStation',
      'PCSX2'
    ];

    for (const engine of enginesToTest) {
      const card = enginesPage.getEngineCard(engine);
      
      const isCardVisible = await card.isVisible();
      if (!isCardVisible) {
        console.log(`Skipping ${engine} as it is not rendered on this platform.`);
        continue;
      }

      // Some engines might be rendered but have an unsupported button
      const isUnsupported = await card.getByText('Unsupported', { exact: true }).isVisible();
      if (isUnsupported) {
        console.log(`Skipping ${engine} as it is marked unsupported.`);
        continue;
      }

      const isInstalled = await card.getByText('Installed', { exact: true }).isVisible();
      if (!isInstalled) {
        const installButton = enginesPage.getInstallButton(engine);
        await expect(installButton).toBeVisible();
        await enginesPage.installEngine(engine);
        
        // 3. Verify completion returns status to "Installed"
        const installedLabel = card.getByText('Installed', { exact: true });
        await expect(installedLabel).toBeVisible({ timeout: 300000 });
      }
    }
  });
});
