import { EmulatorConfigurator } from './types';
import { DolphinConfigurator } from './DolphinConfigurator';
// import { MesenConfigurator } from './MesenConfigurator';

export const getConfigurator = (consoleId: string): EmulatorConfigurator | null => {
  switch (consoleId) {
    case 'gc':
    case 'wii':
      return new DolphinConfigurator();
    
    // case 'nes':
    //   return new MesenConfigurator();

    default:
      return null;
  }
};