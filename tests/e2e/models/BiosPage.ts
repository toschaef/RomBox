import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class BiosPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  getDropResultLabel(fileName: string): Locator {
    return this.page.getByText(fileName).first();
  }

  async dragAndDropBios(fullPath: string, fileName: string) {
    await this.dragAndDropFile({ fullPath, fileName });
  }
}
