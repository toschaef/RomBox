import { IS_MAC } from '../../../shared/constants';
import { EmulatorConfigurator } from './types';
import { DolphinConfigurator } from './DolphinConfigurator';
import { AresConfigurator } from './AresConfigurator';
import { MesenConfigurator } from './MesenConfigurator';
import { MelonDSConfigurator } from './MelonDSConfigurator';
import { AzaharConfigurator } from './AzaharConfigurator';
import { PCSX2Configurator } from './PCSX2Configurator';
import { DuckStationConfigurator } from './DuckStationConfigurator';
import type { Game } from '../../../shared/types';

export const getConfigurator = (game: Game): EmulatorConfigurator | null => {
  switch (game.consoleId) {
    case 'nes':
    case 'gg':
    case 'sms':
    case 'pce':
    case 'snes':
    case 'gb':
    case 'gba':
      return new MesenConfigurator(game.consoleId);

    case 'ds':
      return new MelonDSConfigurator();

    case '3ds':
      return new AzaharConfigurator();

    case 'gc':
    case 'wii':
      return new DolphinConfigurator(game);

    case 'n64':
      if (IS_MAC) {
        return new AresConfigurator();
      } else {
        return null;
      }

    case 'ps1':
      return new DuckStationConfigurator();

    case 'ps2':
      return new PCSX2Configurator();

    default:
      return null;
  }
};