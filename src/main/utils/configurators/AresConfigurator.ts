import fs from 'fs';
import path from 'path';
import { BaseConfigurator } from './BaseConfigurator';
import { osHandler } from '../../platform';

export class AresConfigurator extends BaseConfigurator {
  async configure(): Promise<void> {
    const configDir = osHandler.getEmulatorConfigPath('ares');
    const bmlPath = path.join(configDir, 'settings.bml');

    if (!fs.existsSync(bmlPath)) {
      return;
    }

    console.log(`[AresConfigurator] Patching config at: ${bmlPath}`);
    let content = fs.readFileSync(bmlPath, 'utf-8');

    const TARGET_SCALE = '1'; 

    if (/Scale:\s*\d+/.test(content)) {
      content = content.replace(/Scale:\s*\d+/, `Scale: ${TARGET_SCALE}`);
    }
    
    fs.writeFileSync(bmlPath, content);
  }
}