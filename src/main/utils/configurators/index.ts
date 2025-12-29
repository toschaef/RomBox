import { IS_MAC } from '../../../shared/constants';
import { EmulatorConfigurator } from './types';
import { DolphinConfigurator } from './DolphinConfigurator';
import { AresConfigurator } from './AresConfigurator';
import { MesenConfigurator } from './MesenConfigurator';

export const getConfigurator = (consoleId: string): EmulatorConfigurator | null => {
  switch (consoleId) {
    case 'nes':
    case 'gg':
    case 'sms':
    case 'pce':
    case 'snes':
    case 'gb':
    case 'gba':
      return new MesenConfigurator(consoleId);

    case 'gc':
    case 'wii':
      return new DolphinConfigurator();

    case 'n64':
      if (IS_MAC) {
        return new AresConfigurator();
      } else {
        return null; 
      }

    default:
      return null;
  }
};