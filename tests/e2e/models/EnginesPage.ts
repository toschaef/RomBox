import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class EnginesPage extends BasePage {
  readonly downloadingLabel: Locator;
  readonly extractingLabel: Locator;
  readonly installedLabel: Locator;

  constructor(page: Page) {
    super(page);
    this.downloadingLabel = this.page.getByText('Downloading emulator files...');
    this.extractingLabel = this.page.getByText('Extracting files to directory...');
    this.installedLabel = this.page.getByText('Installed').first();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getInstallButton(engineName: string): Locator {
    return this.page.getByRole('button', { name: 'Install' }).first();
  }

  async installEngine(engineName: string) {
    await this.getInstallButton(engineName).click();
  }
}
