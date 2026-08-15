import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LibraryPage extends BasePage {
  readonly searchBar: Locator;
  readonly manualImportButton: Locator;

  constructor(page: Page) {
    super(page);
    this.searchBar = this.page.getByPlaceholder('Search');
    this.manualImportButton = this.page.getByTestId('import-button');
  }

  getGameCard(title: string): Locator {
    return this.page.getByRole('heading', { name: title }).first();
  }

  /** remounts the library so it refetches - file state is computed on read */
  async refresh() {
    await this.navigateToSettings();
    await this.navigateToLibrary();
    await this.page.waitForSelector('#root');
  }

  async openGameMenu() {
    await this.page.getByTestId('game-menu-button').first().click();
  }

  /** delete goes through the in-app confirm modal, not a native confirm() */
  async deleteGameFromMenu() {
    await this.page.getByTestId('delete-game').click();
    await this.page.getByTestId('confirm-modal-confirm').click();
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
