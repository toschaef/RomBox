import fs from "fs";
import path from "path";
import { app, dialog } from "electron";

import type { Game } from "../../shared/types";
import type { EngineID } from "../../shared/types/engines";
import type { SaveMetadata, SaveStatus } from "../../shared/types/saves";
import { getEngineIdFromConsoleId } from "../../shared/constants";
import { osHandler } from "../platform";
import { Logger } from "../utils/logger";

import AdmZip from "adm-zip";

const log = Logger.create('SaveService');

const USERDATA = app.getPath("userData");
const SAVE_CACHE_PATH = path.join(USERDATA, "saves");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getEmulatorSaveDir(game: Game): string {
  return osHandler.getSavePath(game);
}

function getSaveExtensions(engineId: EngineID): string[] {
  switch (engineId) {
    case "mesen":
      return [".sav", ".mss", ".sram", ".srm"];
    case "melonds":
      return [".sav", ".dsv"];
    case "dolphin":
      return [".gci", ".raw"];
    case "azahar":
      return [".sav"];
    case "ares":
      return [".sav", ".srm"];
    case "rmg":
      return [".sav", ".eep", ".sra", ".fla"];
    case "duckstation":
      return [".mcd", ".mcr"];
    case "pcsx2":
      return [".ps2", ".mcd"];
    default:
      return [".sav"];
  }
}

function getRomBasename(game: Game): string {
  return path.basename(game.filePath, path.extname(game.filePath));
}

function getCacheDir(consoleId: string): string {
  return path.join(SAVE_CACHE_PATH, consoleId);
}

function findEmulatorSaves(game: Game): string[] {
  const engineId = getEngineIdFromConsoleId(game.consoleId);
  const saveDir = getEmulatorSaveDir(game);
  const extensions = getSaveExtensions(engineId);
  const romBasename = getRomBasename(game);

  log.debug('Finding saves', { gameTitle: game.title, engineId, saveDir, romBasename, extensions });

  if (!fs.existsSync(saveDir)) {
    log.debug('Save directory does not exist', { saveDir });
    return [];
  }

  const saves: string[] = [];

  try {
    const files = fs.readdirSync(saveDir, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile()) continue;

      const fileBasename = path.basename(file.name, path.extname(file.name));
      const fileExt = path.extname(file.name).toLowerCase();

      const isPlayStation = engineId === "duckstation" || engineId === "pcsx2";
      const gameTitle = game.title.replace(/[^a-zA-Z0-9\s]/g, "").trim();

      let matches = false;
      if (isPlayStation) {
        matches = extensions.includes(fileExt) && (
          fileBasename.toLowerCase().includes(romBasename.toLowerCase()) ||
          fileBasename.toLowerCase().includes(gameTitle.toLowerCase()) ||
          fileBasename.toLowerCase().startsWith("shared_card") ||
          fileBasename.toLowerCase().startsWith("mcd")
        );
      } else {
        matches = fileBasename.toLowerCase().startsWith(romBasename.toLowerCase()) &&
          extensions.includes(fileExt);
      }

      if (matches) {
        saves.push(path.join(saveDir, file.name));
      }
    }

    log.debug('Saves found', { count: saves.length, files: saves.map(s => path.basename(s)) });
  } catch (err) {
    log.error('Failed to read save directory', err);
  }

  return saves;
}

function findCachedSaves(game: Game): string[] {
  const cacheDir = getCacheDir(game.consoleId);
  const engineId = getEngineIdFromConsoleId(game.consoleId);
  const extensions = getSaveExtensions(engineId);
  const romBasename = getRomBasename(game);

  if (!fs.existsSync(cacheDir)) return [];

  const saves: string[] = [];

  try {
    const files = fs.readdirSync(cacheDir, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile()) continue;

      const fileBasename = path.basename(file.name, path.extname(file.name));
      const fileExt = path.extname(file.name).toLowerCase();

      const isPlayStation = engineId === "duckstation" || engineId === "pcsx2";
      const gameTitle = game.title.replace(/[^a-zA-Z0-9\s]/g, "").trim();

      let matches = false;
      if (isPlayStation) {
        matches = extensions.includes(fileExt) && (
          fileBasename.toLowerCase().includes(romBasename.toLowerCase()) ||
          fileBasename.toLowerCase().includes(gameTitle.toLowerCase()) ||
          fileBasename.toLowerCase().startsWith("shared_card") ||
          fileBasename.toLowerCase().startsWith("mcd")
        );
      } else {
        matches = fileBasename.toLowerCase().startsWith(romBasename.toLowerCase()) &&
          extensions.includes(fileExt);
      }

      if (matches) {
        saves.push(path.join(cacheDir, file.name));
      }
    }
  } catch (err) {
    log.error('Failed to read cache directory', err);
  }

  return saves;
}

export const SaveService = {
  getSaveStatus(game: Game): SaveStatus {
    const engineId = getEngineIdFromConsoleId(game.consoleId);
    const cacheDir = getCacheDir(game.consoleId);
    const emulatorSaveDir = getEmulatorSaveDir(game);
    const cachedSaves = findCachedSaves(game);

    const cachedFiles: SaveMetadata[] = cachedSaves.map(savePath => {
      const stats = fs.statSync(savePath);
      return {
        gameId: game.id,
        gameName: game.title,
        gameFileName: path.basename(game.filePath),
        consoleId: game.consoleId,
        engineId,
        fileName: path.basename(savePath),
        cachedAt: stats.mtimeMs,
        sizeBytes: stats.size,
      };
    });

    return {
      gameId: game.id,
      gameName: game.title,
      gameFileName: path.basename(game.filePath),
      consoleId: game.consoleId,
      engineId,
      hasCachedSave: cachedFiles.length > 0,
      cachedFiles,
      emulatorSaveDir,
      cacheDir,
    };
  },

  backupSave(game: Game): { success: boolean; backedUpFiles: string[]; error?: string } {
    const saveLog = log.child({ gameId: game.id, title: game.title });
    saveLog.info('Backing up saves');

    const cacheDir = getCacheDir(game.consoleId);
    ensureDir(cacheDir);

    const emulatorSaves = findEmulatorSaves(game);

    if (emulatorSaves.length === 0) {
      saveLog.warn('No saves to backup');
      return { success: true, backedUpFiles: [], error: "No save files found for this game" };
    }

    const backedUpFiles: string[] = [];

    for (const savePath of emulatorSaves) {
      const fileName = path.basename(savePath);
      const destPath = path.join(cacheDir, fileName);

      try {
        fs.copyFileSync(savePath, destPath);
        backedUpFiles.push(fileName);
      } catch (err) {
        saveLog.error('Failed to backup save file', { savePath, error: (err as Error)?.message ?? err });
      }
    }

    saveLog.info('Backup complete', { count: backedUpFiles.length, files: backedUpFiles });
    return { success: true, backedUpFiles };
  },

  restoreSave(game: Game): { success: boolean; restoredFiles: string[]; error?: string } {
    const saveLog = log.child({ gameId: game.id, title: game.title });
    saveLog.info('Restoring saves');

    const emulatorSaveDir = getEmulatorSaveDir(game);
    ensureDir(emulatorSaveDir);

    const cachedSaves = findCachedSaves(game);
    saveLog.debug('Cached saves found', { count: cachedSaves.length, files: cachedSaves.map(s => path.basename(s)) });

    if (cachedSaves.length === 0) {
      saveLog.debug('No cached saves to restore');
      return { success: false, restoredFiles: [], error: "No cached saves found for this game" };
    }

    const restoredFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const savePath of cachedSaves) {
      const fileName = path.basename(savePath);
      const destPath = path.join(emulatorSaveDir, fileName);

      try {
        const cachedStats = fs.statSync(savePath);

        if (fs.existsSync(destPath)) {
          const destStats = fs.statSync(destPath);

          if (destStats.mtimeMs > cachedStats.mtimeMs) {
            saveLog.warn('Skipping restore: destination is newer than cache', {
              fileName,
              cachedMtime: new Date(cachedStats.mtimeMs).toISOString(),
              destMtime: new Date(destStats.mtimeMs).toISOString(),
            });
            skippedFiles.push(fileName);
            continue;
          }
        }

        fs.copyFileSync(savePath, destPath);
        restoredFiles.push(fileName);
      } catch (err) {
        saveLog.error('Failed to restore save file', { savePath, error: (err as Error)?.message ?? err });
      }
    }

    saveLog.info('Restore complete', { count: restoredFiles.length, files: restoredFiles, skipped: skippedFiles });
    return { success: true, restoredFiles };
  },

  deleteCachedSave(game: Game): { success: boolean; deletedFiles: string[]; error?: string } {
    log.info('Deleting cached saves', { gameId: game.id, title: game.title });

    const cachedSaves = findCachedSaves(game);
    const deletedFiles: string[] = [];

    for (const savePath of cachedSaves) {
      try {
        fs.unlinkSync(savePath);
        deletedFiles.push(path.basename(savePath));
      } catch (err) {
        log.warn('Failed to delete save file', { savePath, error: (err as Error)?.message ?? err });
      }
    }

    log.info('Cached saves deleted', { count: deletedFiles.length, files: deletedFiles });
    return { success: true, deletedFiles };
  },

  listAllSaves(): SaveStatus[] {
    ensureDir(SAVE_CACHE_PATH);

    const saves: SaveStatus[] = [];

    try {
      const consoleDirs = fs.readdirSync(SAVE_CACHE_PATH, { withFileTypes: true });

      for (const consoleDir of consoleDirs) {
        if (!consoleDir.isDirectory()) continue;
        if (consoleDir.name === ".DS_Store") continue;

        const consoleId = consoleDir.name as Game["consoleId"];
        const consoleCacheDir = getCacheDir(consoleId);
        const engineId = getEngineIdFromConsoleId(consoleId);
        const extensions = getSaveExtensions(engineId);

        const files = fs.readdirSync(consoleCacheDir, { withFileTypes: true });

        for (const file of files) {
          if (!file.isFile()) continue;
          
          const fileExt = path.extname(file.name).toLowerCase();
          if (!extensions.includes(fileExt)) continue;

          const filePath = path.join(consoleCacheDir, file.name);
          const stats = fs.statSync(filePath);
          const romBasename = path.basename(file.name, fileExt);

          saves.push({
            gameId: romBasename,
            gameName: romBasename,
            gameFileName: file.name,
            consoleId,
            engineId,
            hasCachedSave: true,
            cachedFiles: [{
              gameId: romBasename,
              gameName: romBasename,
              gameFileName: file.name,
              consoleId,
              engineId,
              fileName: file.name,
              cachedAt: stats.mtimeMs,
              sizeBytes: stats.size,
            }],
            emulatorSaveDir: "",
            cacheDir: consoleCacheDir,
          });
        }
      }
    } catch (err) {
      log.error('Failed to list saves', err);
    }

    return saves;
  },

  async exportSave(game: Game): Promise<{ success: boolean; exportedTo?: string; error?: string }> {
    const cachedSaves = findCachedSaves(game);

    if (cachedSaves.length === 0) {
      log.warn('No cached saves found for this game');
      return { success: false, error: "No cached saves found for this game" };
    }

    const firstSave = cachedSaves[0];
    const defaultName = cachedSaves.length === 1
      ? path.basename(firstSave)
      : `${game.title.replace(/[^a-zA-Z0-9]/g, "_")}_saves.zip`;

    const result = await dialog.showSaveDialog({
      title: "Export Save File",
      defaultPath: path.join(app.getPath("downloads"), defaultName),
      filters: cachedSaves.length === 1
        ? [{ name: "Save Files", extensions: [path.extname(firstSave).slice(1) || "sav"] }]
        : [{ name: "ZIP Archive", extensions: ["zip"] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: "Export cancelled" };
    }

    try {
      if (cachedSaves.length === 1) {
        fs.copyFileSync(firstSave, result.filePath);
      } else {
        const zip = new AdmZip();

        for (const savePath of cachedSaves) {
          if (fs.existsSync(savePath)) {
            zip.addLocalFile(savePath);
          }
        }

        zip.writeZip(result.filePath);
      }

      return { success: true, exportedTo: result.filePath };
    } catch (err) {
      return { success: false, error: (err as Error)?.message ?? "Failed to export save" };
    }
  },
};