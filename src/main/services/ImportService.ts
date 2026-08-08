import fs from "fs";
import path from "path";
import { app } from "electron";

import { ScannerService, type ScanResult } from "./ScannerService";
import { LibraryService } from "./LibraryService";
import { BiosService } from "./BiosService";
import { EngineService } from "./EngineService";
import { settingsService } from "./SettingsService";
import { Extractor } from "../utils/extractor";
import { Logger } from "../utils/logger";
import { getConsoleNameFromId } from "../../shared/emulators/derived";
import type { EngineID } from "../../shared/types/engines";
import type { Game } from "../../shared/types";

/** Progress messages for the renderer's install banner. */
export type InstallStatusListener = (status: string) => void;

export interface ImportResult {
  success: boolean;
  games: Game[];
  biosCount: number;
  biosLabels: string[];
  nothingRecognized: boolean;
  fileExtension?: string;
  message: string;
}

const ARCHIVE_EXTENSIONS = [".zip", ".7z"];

export const ImportService = {
  async importPath(filePath: string, notify: InstallStatusListener): Promise<ImportResult> {
    const log = Logger.create("ImportService", { path: filePath });
    log.info("Processing file drop");

    try {
      const results = await ScannerService.scanPath(filePath);
      log.info("Scan complete", { resultCount: results.length });

      const games: Game[] = [];
      const biosLabels: string[] = [];
      const autoInstall = settingsService.get("setup.autoInstallEngines");

      for (const result of results) {
        if (result.type === "game") {
          games.push(await importGame(result, autoInstall, notify, log));
        } else if (result.type === "bios") {
          biosLabels.push(await importBios(result, autoInstall, notify, log));
        }
      }

      log.info("File drop processing complete", {
        gamesProcessed: games.length,
        biosFilesProcessed: biosLabels.length,
      });

      return summarize(filePath, games, biosLabels);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
      log.error("Drop failed", { error: err, message });
      return {
        success: false,
        games: [],
        biosCount: 0,
        biosLabels: [],
        nothingRecognized: false,
        message: message || "Unknown Error",
      };
    }
  },
};

type ImportLogger = ReturnType<typeof Logger.create>;

async function importGame(
  result: Extract<ScanResult, { type: "game" }>,
  autoInstall: boolean,
  notify: InstallStatusListener,
  log: ImportLogger
): Promise<Game> {
  log.info("Processing game", { consoleId: result.consoleId });

  const gameData = await ScannerService.importGame(result);
  const created = await LibraryService.createGame(gameData);
  log.info("Game imported successfully", { gameId: created.game.id, title: created.game.title });

  if (autoInstall) await ensureEngineInstalled(gameData.engineId, notify, log);

  return created.game;
}

/** Installs BIOS and returns the label shown in the import summary. */
async function importBios(
  result: Extract<ScanResult, { type: "bios" }>,
  autoInstall: boolean,
  notify: InstallStatusListener,
  log: ImportLogger
): Promise<string> {
  log.info("Processing BIOS file", { consoleId: result.consoleId });

  const fileName = path.basename(result.zipEntryName ?? result.filePath);
  const label = `${getConsoleNameFromId(result.consoleId)} BIOS (${fileName})`;

  const isDirectory = !result.zipEntryName && fs.statSync(result.filePath).isDirectory();

  if (isDirectory) {
    log.info("Installing BIOS from directory");
    await BiosService.installBios(result.consoleId, result.filePath);
  } else {
    // single files (and archive entries) are staged somewhere writable first,
    // because installBios copies from a real path on disk.
    const tempDir = path.join(
      app.getPath("temp"),
      `rombox_drop_${result.consoleId}_${Date.now()}`
    );
    fs.mkdirSync(tempDir, { recursive: true });
    log.debug("Created temp directory", { tempDir });

    try {
      log.info("Extracting BIOS file", { originalName: fileName });
      await Extractor.extractToFile(result.filePath, path.join(tempDir, fileName), result.zipEntryName);
      await BiosService.installBios(result.consoleId, path.join(tempDir, fileName));
      log.info("BIOS installed successfully", { consoleId: result.consoleId });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        log.debug("Cleaned up temp directory");
      } catch (err) {
        log.warn("Failed to clean up temp directory", err);
      }
    }
  }

  if (autoInstall) await ensureEngineInstalled(result.engineId, notify, log);

  return label;
}

// kicks off an engine install if one is not already present
async function ensureEngineInstalled(
  engineId: EngineID,
  notify: InstallStatusListener,
  log: ImportLogger
): Promise<void> {
  if (await EngineService.getEnginePath(engineId)) {
    log.debug("Engine already installed, skipping auto-install", { engineId });
    return;
  }

  log.info("Auto-installing engine", { engineId });
  notify("Installing emulator…");

  EngineService.installEngine(engineId, (status) => {
    log.info(`Engine install status: ${status}`, { engineId });
    notify(status);
  })
    .catch((err) => {
      log.error("Failed to auto-install engine", { engineId, error: err?.message });
    })
    .finally(() => {
      notify("complete");
    });
}

function summarize(filePath: string, games: Game[], biosLabels: string[]): ImportResult {
  const nothingRecognized = games.length === 0 && biosLabels.length === 0;
  const fileExtension = path.extname(filePath).toLowerCase() || undefined;

  const message = nothingRecognized
    ? ARCHIVE_EXTENSIONS.includes(fileExtension ?? "")
      ? `No supported games or BIOS files found in ${path.basename(filePath)}`
      : `Unknown extension ${fileExtension ?? "(none)"}`
    : `Processed ${games.length} games and ${biosLabels.length} BIOS files.`;

  return {
    success: !nothingRecognized,
    games,
    biosCount: biosLabels.length,
    biosLabels,
    nothingRecognized,
    fileExtension: nothingRecognized ? fileExtension : undefined,
    message,
  };
}
