import { type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class SettingsPage extends BasePage {
  readonly fullscreenSwitch: Locator;
  readonly resolutionSelect: Locator;

  constructor(page: any) {
    super(page);
    this.fullscreenSwitch = this.page.locator('#launchFullscreen');
    this.resolutionSelect = this.page.getByRole('combobox');
  }

  async toggleFullscreen() {
    await this.fullscreenSwitch.click();
  }

  async selectResolution(resolution: string) {
    await this.resolutionSelect.selectOption(resolution);
  }
}
