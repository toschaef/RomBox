import type { ConsoleID, Game } from "../../shared/types";
import { getEngineIdFromConsoleId } from "../../shared/emulators/derived";
import type { EngineID } from "../../shared/types/engines";
import type { DirectoryBios, EmulatorModule } from "./types";

export {
  allBasePaths,
  resolveBasePath,
  resolveBiosPath,
  resolveConfigPath,
  resolveSavePath,
} from "./paths";

import type { SaveRoot, SaveRootContext } from "./saveRoots";
import type { EmulatorConfigurator } from "./configuratorTypes";

import { aresPaths } from "./ares/paths";
import { aresSaveRoots } from "./ares/saves";
import { AresConfigurator } from "./ares/configurator";
import { azaharPaths } from "./azahar/paths";
import { azaharSaveRoots } from "./azahar/saves";
import { azaharSystemBios } from "./azahar/bios";
import { AzaharConfigurator } from "./azahar/configurator";
import { dolphinPaths } from "./dolphin/paths";
import { dolphinSaveRoots } from "./dolphin/saves";
import { DolphinConfigurator } from "./dolphin/configurator";
import { duckstationPaths } from "./duckstation/paths";
import { duckstationSaveRoots } from "./duckstation/saves";
import { DuckStationConfigurator } from "./duckstation/configurator";
import { melondsPaths } from "./melonds/paths";
import { melondsSaveRoots } from "./melonds/saves";
import { MelonDSConfigurator } from "./melonds/configurator";
import { mesenPaths } from "./mesen/paths";
import { mesenSaveRoots } from "./mesen/saves";
import { MesenConfigurator } from "./mesen/configurator";
import { pcsx2Paths } from "./pcsx2/paths";
import { pcsx2SaveRoots } from "./pcsx2/saves";
import { PCSX2Configurator } from "./pcsx2/configurator";

export const EMULATORS: Record<EngineID, EmulatorModule> = {
  mesen: {
    engineId: "mesen",
    paths: mesenPaths,
    saveRoots: mesenSaveRoots,
    createConfigurator: (game) => new MesenConfigurator(game.consoleId),
  },
  melonds: {
    engineId: "melonds",
    paths: melondsPaths,
    saveRoots: melondsSaveRoots,
    createConfigurator: () => new MelonDSConfigurator(),
  },
  azahar: {
    engineId: "azahar",
    paths: azaharPaths,
    saveRoots: azaharSaveRoots,
    directoryBios: azaharSystemBios,
    createConfigurator: () => new AzaharConfigurator(),
  },
  dolphin: {
    engineId: "dolphin",
    paths: dolphinPaths,
    saveRoots: dolphinSaveRoots,
    createConfigurator: (game) => new DolphinConfigurator(game),
  },
  ares: {
    engineId: "ares",
    paths: aresPaths,
    saveRoots: aresSaveRoots,
    createConfigurator: () => new AresConfigurator(),
  },
  duckstation: {
    engineId: "duckstation",
    paths: duckstationPaths,
    saveRoots: duckstationSaveRoots,
    createConfigurator: () => new DuckStationConfigurator(),
  },
  pcsx2: {
    engineId: "pcsx2",
    paths: pcsx2Paths,
    saveRoots: pcsx2SaveRoots,
    createConfigurator: () => new PCSX2Configurator(),
  },
};

export function getEmulator(engineId: EngineID): EmulatorModule {
  const emulator = EMULATORS[engineId];
  if (!emulator) throw new Error(`Unknown emulator: ${engineId}`);
  return emulator;
}

export function resolveSaveRoots(ctx: SaveRootContext): SaveRoot[] {
  return getEmulator(ctx.game.engineId)
    .saveRoots(ctx)
    .filter((root): root is SaveRoot => Boolean(root));
}

export function getConfigurator(game: Game): EmulatorConfigurator | null {
  const emulator = EMULATORS[game.engineId];
  return emulator ? emulator.createConfigurator(game) : null;
}

export function getDirectoryBios(consoleId: ConsoleID): DirectoryBios | null {
  return EMULATORS[getEngineIdFromConsoleId(consoleId)]?.directoryBios ?? null;
}

export type { DirectoryBios, EmulatorModule, EmulatorPaths, PlatformRoots } from "./types";
