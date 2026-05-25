import { type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LibraryPage extends BasePage {
  readonly searchBar: Locator;
  readonly manualImportButton: Locator;

  constructor(page: any) {
    super(page);
    this.searchBar = this.page.getByPlaceholder('Search');
    this.manualImportButton = this.page.getByTestId('import-button');
  }

  getGameCard(title: string): Locator {
    return this.page.getByRole('heading', { name: title }).first();
  }

  async search(query: string) {
    if (await this.searchBar.isVisible()) {
      await this.searchBar.fill(query);
    }
  }

  async clickManualImport() {
    await this.manualImportButton.click();
  }

  async dragAndDropRom(fullPath: string, fileName: string) {
    await this.dragAndDropFile({ fullPath, fileName });
  }

  async dragAndDropZip(fullPath: string, fileName: string) {
    await this.dragAndDropFile({ fullPath, fileName, size: 100, type: 'application/zip' });
  }
}
