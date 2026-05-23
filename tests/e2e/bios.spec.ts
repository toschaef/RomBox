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

test.describe('RomBox Bios E2E Suite', () => {
  let electronApp: any;
  let page: any;
  const tempUserDataDir = path.join(__dirname, '../../temp-e2e-bios-userdata');

  test.beforeAll(async () => {
    if (fs.existsSync(tempUserDataDir)) {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempUserDataDir, { recursive: true });

    const executablePath = findExecutable();

    if (executablePath) {
      console.log(`[E2E-Bios] Executing E2E against production build: ${executablePath}`);
      electronApp = await electron.launch({
        executablePath,
        args: [`--user-data-dir=${tempUserDataDir}`, '--hidden-test-window']
      });
    } else {
      console.log('[E2E-Bios] Executing E2E against development build via electron-forge.');
      electronApp = await electron.launch({
        args: [
          path.join(__dirname, '../../'),
          `--user-data-dir=${tempUserDataDir}`,
          '--hidden-test-window'
        ]
      });
    }

    page = await electronApp.firstWindow();
    page.on('console', (msg: any) => console.log(`[Bios E2E Console] ${msg.text()}`));
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
    // 1. Navigate to Bios page
    await page.waitForSelector('#root');
    const biosLink = page.locator('nav >> text=BIOS');
    await biosLink.click();
    await expect(page.url()).toContain('/bios');

    // 2. Create a dummy BIOS file inside our isolated temporary directory
    const dummyBiosPath = path.join(tempUserDataDir, 'scph5501.bin');
    fs.writeFileSync(dummyBiosPath, 'dummy PS1 BIOS file');

    // 3. Simulate drag and drop completely within browser context to preserve file path
    await page.evaluate(({ fullPath }: { fullPath: string }) => {
      const element = document.getElementById('root')?.firstElementChild || document.querySelector('#root');
      if (!element) throw new Error('Root element not found');

      Object.defineProperty(DragEvent.prototype, 'dataTransfer', {
        get() { return (this as any)._mockDataTransfer || null; },
        configurable: true
      });

      const file = Object.create(File.prototype);
      Object.defineProperty(file, 'name', { value: 'scph5501.bin', enumerable: true });
      Object.defineProperty(file, 'size', { value: 16, enumerable: true });
      Object.defineProperty(file, 'type', { value: 'application/octet-stream', enumerable: true });
      Object.defineProperty(file, 'path', { value: fullPath, enumerable: true, configurable: true });

      const mockDataTransfer = {
        files: Object.assign([file], { item: (i: number) => file }),
        types: ['Files'],
        getData: () => '',
        setData: () => ''
      };

      const event = new DragEvent('drop', {
        bubbles: true,
        cancelable: true
      });
      (event as any)._mockDataTransfer = mockDataTransfer;

      element.dispatchEvent(event);
    }, { fullPath: dummyBiosPath });

    // 4. Verify the status changes (e.g. state should reflect warning/missing resolution update)
    const dropResultLabel = page.locator('text=scph5501.bin').first();
    await expect(dropResultLabel).toBeVisible({ timeout: 15000 });
  });
});
