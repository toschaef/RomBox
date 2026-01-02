import path from 'path';
import fs from 'fs';
import { BaseConfigurator } from './BaseConfigurator';
import { osHandler } from '../../platform';
import { IniEditor } from '../editors/ini';

export class DolphinConfigurator extends BaseConfigurator {
  
  async configure(): Promise<void> {
    const configDir = osHandler.getEmulatorConfigPath('dolphin');

    if (configDir && !fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const iniPath = path.join(configDir, 'Dolphin.ini');

    IniEditor.updateIni(iniPath, {
      'Display': {
        'RenderToMain': 'False',
        'Fullscreen': 'False', 
      },
      'Interface': {
        'ShowMainWindow': 'False',
        'ConfirmStop': 'False',
        'UsePanicHandlers': 'False',
        'OnScreenDisplayMessages': 'False',
        'ShowToolbar': 'False',
        'ShowStatusbar': 'False'
      },
      'General': {
        'RecursiveISOPaths': 'False'
      }
    });
  }
}