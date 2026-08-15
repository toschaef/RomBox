import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ControlsPage extends BasePage {
  readonly newProfileButton: Locator;
  readonly renameProfileButton: Locator;
  readonly nameInput: Locator;
  readonly profileSelect: Locator;
  readonly consoleSelect: Locator;

  constructor(page: Page) {
    super(page);
    this.newProfileButton = this.page.getByRole('button', { name: 'New Profile' });
    this.renameProfileButton = this.page.getByRole('button', { name: 'Rename Current' });
    this.nameInput = this.page.getByTestId('profile-name-input');
    this.profileSelect = this.page.getByTestId('profile-select');
    this.consoleSelect = this.page.getByTestId('console-select');
  }

  getControlCard(key: string): Locator {
    return this.page
      .getByTestId('binding-card')
      .filter({ has: this.page.getByText(key, { exact: true }) })
      .first();
  }

  async selectConsole(label: string) {
    await this.consoleSelect.selectOption({ label });
  }

  /** the standard/console switch is a tablist, not a pair of plain buttons */
  async setLayoutMode(mode: 'Standard' | 'Console') {
    await this.page.getByRole('tab', { name: mode, exact: true }).click();
  }

  async createProfile(name: string) {
    await this.newProfileButton.click();
    await this.nameInput.fill(name);
    await this.nameInput.press('Enter');
  }

  async renameProfile(name: string) {
    await this.renameProfileButton.click();
    await this.nameInput.fill(name);
    await this.nameInput.press('Enter');
  }

  async selectProfile(name: string) {
    await this.profileSelect.selectOption({ label: name });
  }

  async remapKey(cardKey: string, keyboardKey: string) {
    const card = this.getControlCard(cardKey);
    await card.click();
    
    const listeningText = card.getByText('Press input');
    await listeningText.waitFor({ state: 'visible' });

    // Wait 500ms to satisfy startedAt threshold and press key
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press(keyboardKey);
    
    await listeningText.waitFor({ state: 'hidden' });
  }
}
