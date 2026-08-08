import fs from "fs";

import { EngineService } from "../EngineService";
import { BiosService } from "../BiosService";
import { Logger } from "../../utils/logger";
import type { Game } from "../../../shared/types";

const log = Logger.create("LaunchPreflight");

/** Why a launch was refused. The renderer branches on these to pick a prompt. */
export type LaunchFailureCode =
  | "ENGINE_INSTALLING"
  | "MISSING_ENGINE"
  | "MISSING_BIOS"
  | "MISSING_FILE";

// string discriminant, not boolean: strictNullChecks is off, where
// `!result.ok` does not narrow a boolean-literal union
export type PreflightResult =
  | { status: "ok"; enginePath: string }
  | { status: "blocked"; code: LaunchFailureCode; message: string };

export async function runPreflight(game: Game): Promise<PreflightResult> {
  const gameLog = log.child({ gameId: game.id, title: game.title });

  gameLog.info("Checking engine path", { engineId: game.engineId });
  const enginePath = await EngineService.getEnginePath(game.engineId);

  if (!enginePath) {
    if (EngineService.isEngineInstalling(game.engineId)) {
      gameLog.warn("Engine is currently installing", { engineId: game.engineId });
      return {
        status: "blocked",
        code: "ENGINE_INSTALLING",
        message: `Emulator for ${game.consoleId} is currently installing. Please wait.`,
      };
    }

    gameLog.warn("Engine not installed", { consoleId: game.consoleId });
    return {
      status: "blocked",
      code: "MISSING_ENGINE",
      message: `Emulator for ${game.consoleId} not installed.`,
    };
  }

  gameLog.info("Engine found", { enginePath });

  const bios = checkBios(game, gameLog);
  if (bios) return bios;

  if (!fs.existsSync(game.filePath)) {
    gameLog.warn("Game file missing", { filePath: game.filePath });
    return {
      status: "blocked",
      code: "MISSING_FILE",
      message: `Game file not found: ${game.filePath}`,
    };
  }

  return { status: "ok", enginePath };
}

// returns a failure only when required BIOS is still missing after trying the
function checkBios(
  game: Game,
  gameLog: ReturnType<typeof log.child>
): PreflightResult | null {
  gameLog.info("Checking BIOS status");
  const status = BiosService.getGameBiosStatus(game);
  gameLog.debug("BIOS status", status);

  if (!status.needsBios || status.biosState !== "missing") return null;

  gameLog.info("BIOS missing, checking cache");
  BiosService.ensureBiosInstalledFromCache(game.consoleId);

  const afterCache = BiosService.getGameBiosStatus(game);
  gameLog.debug("BIOS status after cache check", afterCache);

  if (afterCache.biosState === "missing") {
    return {
      status: "blocked",
      code: "MISSING_BIOS",
      message: afterCache.missingRequiredFiles.join(", "),
    };
  }

  return null;
}
