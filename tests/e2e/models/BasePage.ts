import { type Page, type Locator } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly brand: Locator;
  readonly libraryLink: Locator;
  readonly biosLink: Locator;
  readonly controlsLink: Locator;
  readonly enginesLink: Locator;
  readonly settingsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.brand = page.locator('aside').getByText('RomBox');
    this.libraryLink = page.getByRole('link', { name: 'Library', exact: true });
    this.biosLink = page.getByRole('link', { name: 'Bios', exact: true });
    this.controlsLink = page.getByRole('link', { name: 'Controls', exact: true });
    this.enginesLink = page.getByRole('link', { name: 'Engines', exact: true });
    this.settingsLink = page.getByRole('link', { name: 'Settings', exact: true });
  }

  async waitForRoot() {
    await this.page.waitForSelector('#root');
  }

  async navigateToLibrary() {
    await this.libraryLink.click();
  }

  async navigateToBios() {
    await this.biosLink.click();
  }

  async navigateToControls() {
    await this.controlsLink.click();
  }

  async navigateToEngines() {
    await this.enginesLink.click();
  }

  async navigateToSettings() {
    await this.settingsLink.click();
  }

  /**
   * Helper to perform drag and drop of files within the browser context.
   */
  async dragAndDropFile(options: {
    fullPath: string;
    fileName: string;
    size?: number;
    type?: string;
  }) {
    const { fullPath, fileName, size = 16, type = 'application/octet-stream' } = options;
    await this.page.evaluate(
      ({ fullPath, fileName, size, type }) => {
        const element = document.getElementById('root')?.firstElementChild || document.querySelector('#root');
        if (!element) throw new Error('Root element not found');

        Object.defineProperty(DragEvent.prototype, 'dataTransfer', {
          get() { return (this as any)._mockDataTransfer || null; },
          configurable: true
        });

        const file = Object.create(File.prototype);
        Object.defineProperty(file, 'name', { value: fileName, enumerable: true });
        Object.defineProperty(file, 'size', { value: size, enumerable: true });
        Object.defineProperty(file, 'type', { value: type, enumerable: true });
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
        (event as any)._mockDataTransfer = mockDataTransfer;

        element.dispatchEvent(event);
      },
      { fullPath, fileName, size, type }
    );
  }
}
