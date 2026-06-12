import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ControlsPage extends BasePage {
  readonly newProfileButton: Locator;
  readonly nameInput: Locator;
  readonly saveButton: Locator;
  readonly profileSelect: Locator;

  constructor(page: Page) {
    super(page);
    this.newProfileButton = this.page.getByRole('button', { name: 'New Profile' });
    this.nameInput = this.page.getByPlaceholder('Profile Name');
    this.saveButton = this.page.getByRole('button', { name: 'Save', exact: true });
    this.profileSelect = this.page.getByRole('combobox');
  }

  getControlCard(key: string): Locator {
    return this.page.locator('.relative.w-full.p-4').filter({ has: this.page.getByText(key, { exact: true }) }).first();
  }

  async createProfile(name: string) {
    await this.newProfileButton.click();
    await this.nameInput.fill(name);
    await this.saveButton.click();
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
