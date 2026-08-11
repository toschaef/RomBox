import fs from "fs";
import path from "path";
import { app, dialog } from "electron";

import type { Game } from "../../shared/types";
import type { SaveImportIssue, SaveMetadata, SaveStatus } from "../../shared/types/saves";
import { getEngineIdFromConsoleId } from "../../shared/emulators/derived";
import { getSaveRoots, getConsoleCacheDir, type SaveRoot } from "../config/saveLayouts";
import { SAVE_FORMATS } from "../config/saveFormats";
import { planImport, type ImportPlan, type ImportPlanResult } from "../utils/saves/importPlanner";
import { osHandler } from "../platform";
import { Logger } from "../utils/logger";

import AdmZip from "adm-zip";

const log = Logger.create('SaveService');

const USERDATA = app.getPath("userData");
const SAVE_CACHE_PATH = path.join(USERDATA, "saves");
const IMPORT_SNAPSHOT_PATH = path.join(SAVE_CACHE_PATH, "_replaced");
const SNAPSHOTS_KEPT_PER_CONSOLE = 5;

/** cache subdirectories that are not console caches */
const CACHE_INTERNAL_PREFIX = "_";

interface SaveFile {
  root: SaveRoot;
  /** path relative to the root's directory, preserving subdirectories */
  relPath: string;
  absPath: string;
  /** the file is named after this game (always true for shared containers we cannot attribute) */
  matched: boolean;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getEmulatorSaveDir(game: Game): string {
  return osHandler.getSavePath(game);
}

function getRomBasename(game: Game): string {
  return path.basename(game.filePath, path.extname(game.filePath));
}

function getCacheDir(consoleId: string): string {
  return getConsoleCacheDir(SAVE_CACHE_PATH, consoleId);
}

/** Lists files under dir as root-relative paths, honouring the root's filters. */
function walkRoot(dir: string, root: SaveRoot): string[] {
  const results: string[] = [];

  const visit = (current: string, prefix: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      log.debug('Failed to read save directory', { dir: current, error: (err as Error)?.message });
      return;
    }

    for (const entry of entries) {
      const relPath = prefix ? path.join(prefix, entry.name) : entry.name;

      if (entry.isDirectory()) {
        if (!root.recursive) continue;
        if (root.excludeDirs?.includes(entry.name)) continue;
        visit(path.join(current, entry.name), relPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (entry.name === ".DS_Store") continue;

      if (root.extensions) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!root.extensions.includes(ext)) continue;
      }

      results.push(relPath);
    }
  };

  if (!fs.existsSync(dir)) return results;
  visit(dir, "");
  return results;
}

function walkEmptyDirs(dir: string, root: SaveRoot): string[] {
  if (!root.recursive || !fs.existsSync(dir)) return [];

  const empty: string[] = [];

  /** returns whether the subtree contains at least one file */
  const visit = (current: string, prefix: string): boolean => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return false;
    }

    let hasFile = false;

    for (const entry of entries) {
      const relPath = prefix ? path.join(prefix, entry.name) : entry.name;

      if (entry.isDirectory()) {
        if (root.excludeDirs?.includes(entry.name)) continue;
        if (visit(path.join(current, entry.name), relPath)) hasFile = true;
        else empty.push(relPath);
        continue;
      }

      if (entry.isFile() && entry.name !== ".DS_Store") hasFile = true;
    }

    return hasFile;
  };

  visit(dir, "");

  return empty.filter(candidate =>
    !empty.some(other => other !== candidate && other.startsWith(candidate + path.sep))
  );
}

/**
 * Whether a save file belongs to a specific game
 */
function fileBelongsToGame(relPath: string, game: Game): boolean {
  const topSegment = relPath.split(path.sep)[0];
  const name = path.basename(topSegment, path.extname(topSegment)).toLowerCase();
  const romBasename = getRomBasename(game).toLowerCase();
  const title = game.title.replace(/[^a-zA-Z0-9\s]/g, "").trim().toLowerCase();

  if (name.startsWith(romBasename)) return true;
  if (title.length > 0 && name.includes(title)) return true;
  return false;
}

/** Collects save files for a game from either the emulator's storage or the cache. */
function collectSaveFiles(game: Game, side: "emulator" | "cache"): SaveFile[] {
  const roots = getSaveRoots(game, SAVE_CACHE_PATH);
  const files: SaveFile[] = [];

  for (const root of roots) {
    const dir = side === "emulator" ? root.dir : root.cacheDir;

    for (const relPath of walkRoot(dir, root)) {
      const matched = fileBelongsToGame(relPath, game);

      if (root.scope === "per-game" && !matched) continue;

      files.push({ root, relPath, absPath: path.join(dir, relPath), matched });
    }
  }

  return files;
}

/** Empty directories to mirror alongside the files, as root-relative paths. */
function collectEmptyDirs(game: Game, side: "emulator" | "cache"): { root: SaveRoot; relPath: string }[] {
  const roots = getSaveRoots(game, SAVE_CACHE_PATH);
  const dirs: { root: SaveRoot; relPath: string }[] = [];

  for (const root of roots) {
    const dir = side === "emulator" ? root.dir : root.cacheDir;

    for (const relPath of walkEmptyDirs(dir, root)) {
      if (root.scope === "per-game" && !fileBelongsToGame(relPath, game)) continue;
      dirs.push({ root, relPath });
    }
  }

  return dirs;
}

/** Copies only when the destination is missing or differs, so unchanged NAND trees are cheap. */
function copyIfChanged(srcPath: string, destPath: string): boolean {
  try {
    const srcStats = fs.statSync(srcPath);
    if (fs.existsSync(destPath)) {
      const destStats = fs.statSync(destPath);
      if (destStats.size === srcStats.size && Math.floor(destStats.mtimeMs) === Math.floor(srcStats.mtimeMs)) {
        return false;
      }
    }

    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
    fs.utimesSync(destPath, srcStats.atime, srcStats.mtime);
    return true;
  } catch (err) {
    log.error('Failed to copy save file', { srcPath, destPath, error: (err as Error)?.message ?? err });
    return false;
  }
}

/**
 * whether dest holds exactly what src holds
 */
function mirrors(srcPath: string, destPath: string): boolean {
  try {
    if (fs.statSync(srcPath).size !== fs.statSync(destPath).size) return false;
    return fs.readFileSync(srcPath).equals(fs.readFileSync(destPath));
  } catch {
    return false;
  }
}

function newestMtime(paths: string[]): number {
  let newest = 0;
  for (const p of paths) {
    try {
      const { mtimeMs } = fs.statSync(p);
      if (mtimeMs > newest) newest = mtimeMs;
    } catch {
      // file vanished between listing and stat; ignore
    }
  }
  return newest;
}

function totalSize(paths: string[]): number {
  let total = 0;
  for (const p of paths) {
    try {
      total += fs.statSync(p).size;
    } catch {
      // ignore
    }
  }
  return total;
}

/** File extensions offered in the import dialog for this game's console. */
function importableExtensions(roots: SaveRoot[]): string[] {
  const extensions = new Set<string>(["zip"]);

  for (const root of roots) {
    for (const formatId of root.importFormats ?? []) {
      for (const extension of SAVE_FORMATS[formatId].extensions) {
        extensions.add(extension.replace(".", ""));
      }
    }
  }

  return [...extensions];
}

/** Turns rejections into one sentence a notification can carry. */
function describeRejections(rejections: SaveImportIssue[]): string {
  const [first] = rejections;
  const detail = `${path.basename(first.file)}: ${first.reason}`;
  return rejections.length === 1
    ? detail
    : `${detail} (and ${rejections.length - 1} more file${rejections.length === 2 ? "" : "s"})`;
}

/**
 * Copies everything the plan is about to overwrite into a timestamped folder
 * and returns it
 */
function snapshotReplacedFiles(game: Game, plan: ImportPlan): string | undefined {
  const snapshotDir = path.join(
    IMPORT_SNAPSHOT_PATH,
    game.consoleId,
    new Date().toISOString().replace(/[:.]/g, "-"),
  );

  let replaced = 0;

  for (const entry of plan.entries) {
    for (const [side, dir] of [["cache", entry.root.cacheDir], ["emulator", entry.root.dir]] as const) {
      const existing = path.join(dir, entry.relPath);
      if (!fs.existsSync(existing)) continue;

      const destPath = path.join(snapshotDir, side, entry.root.id, entry.relPath);
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(existing, destPath);
      replaced++;
    }
  }

  if (replaced === 0) return undefined;

  pruneSnapshots(game.consoleId);
  return snapshotDir;
}

function pruneSnapshots(consoleId: string) {
  const consoleDir = path.join(IMPORT_SNAPSHOT_PATH, consoleId);

  try {
    const snapshots = fs.readdirSync(consoleDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    for (const stale of snapshots.slice(0, -SNAPSHOTS_KEPT_PER_CONSOLE)) {
      fs.rmSync(path.join(consoleDir, stale), { recursive: true, force: true });
    }
  } catch (err) {
    log.debug('Could not prune import snapshots', { consoleId, error: (err as Error)?.message });
  }
}

function installPlan(plan: ImportPlan): string[] {
  const imported: string[] = [];

  for (const { root, relPath } of plan.directories) {
    ensureDir(path.join(root.cacheDir, relPath));
    ensureDir(path.join(root.dir, relPath));
  }

  for (const entry of plan.entries) {
    for (const dir of [entry.root.cacheDir, entry.root.dir]) {
      const destPath = path.join(dir, entry.relPath);
      ensureDir(path.dirname(destPath));
      fs.writeFileSync(destPath, entry.buffer);
    }

    imported.push(entry.relPath);
  }

  return imported;
}

export const SaveService = {
  getSaveStatus(game: Game): SaveStatus {
    const engineId = getEngineIdFromConsoleId(game.consoleId);
    const cacheDir = getCacheDir(game.consoleId);
    const emulatorSaveDir = getEmulatorSaveDir(game);
    const cachedSaves = collectSaveFiles(game, "cache");

    const base = {
      gameId: game.id,
      gameName: game.title,
      gameFileName: path.basename(game.filePath),
      consoleId: game.consoleId,
      engineId,
    };

    const cachedFiles: SaveMetadata[] = [];
    const sharedByRoot = new Map<string, SaveFile[]>();

    for (const file of cachedSaves) {
      if (file.root.scope === "shared" && !file.matched) {
        const bucket = sharedByRoot.get(file.root.id) ?? [];
        bucket.push(file);
        sharedByRoot.set(file.root.id, bucket);
        continue;
      }

      try {
        const stats = fs.statSync(file.absPath);
        cachedFiles.push({ ...base, fileName: file.relPath, cachedAt: stats.mtimeMs, sizeBytes: stats.size });
      } catch {
        // ignore
      }
    }

    for (const [rootId, files] of sharedByRoot) {
      const paths = files.map(f => f.absPath);
      cachedFiles.push({
        ...base,
        fileName: `${rootId} (${files.length} file${files.length === 1 ? "" : "s"})`,
        cachedAt: newestMtime(paths),
        sizeBytes: totalSize(paths),
      });
    }

    return {
      ...base,
      hasCachedSave: cachedFiles.length > 0,
      cachedFiles,
      emulatorSaveDir,
      cacheDir,
    };
  },

  backupSave(game: Game): { success: boolean; backedUpFiles: string[]; error?: string } {
    const saveLog = log.child({ gameId: game.id, title: game.title });
    saveLog.info('Backing up saves');

    const emulatorSaves = collectSaveFiles(game, "emulator");

    if (emulatorSaves.length === 0) {
      saveLog.warn('No saves to backup');
      return { success: true, backedUpFiles: [], error: "No save files found for this game" };
    }

    const backedUpFiles: string[] = [];

    for (const file of emulatorSaves) {
      const destPath = path.join(file.root.cacheDir, file.relPath);
      if (copyIfChanged(file.absPath, destPath)) {
        backedUpFiles.push(file.relPath);
      }
    }

    for (const { root, relPath } of collectEmptyDirs(game, "emulator")) {
      ensureDir(path.join(root.cacheDir, relPath));
    }

    saveLog.info('Backup complete', {
      count: backedUpFiles.length,
      scanned: emulatorSaves.length,
      files: backedUpFiles.slice(0, 20),
    });
    return { success: true, backedUpFiles };
  },

  restoreSave(game: Game): { success: boolean; restoredFiles: string[]; error?: string } {
    const saveLog = log.child({ gameId: game.id, title: game.title });
    saveLog.info('Restoring saves');

    const cachedSaves = collectSaveFiles(game, "cache");
    saveLog.debug('Cached saves found', { count: cachedSaves.length });

    if (cachedSaves.length === 0) {
      saveLog.debug('No cached saves to restore');
      return { success: false, restoredFiles: [], error: "No cached saves found for this game" };
    }

    const restoredFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const file of cachedSaves) {
      const destPath = path.join(file.root.dir, file.relPath);

      try {
        const cachedStats = fs.statSync(file.absPath);

        if (fs.existsSync(destPath)) {
          const destStats = fs.statSync(destPath);

          if (destStats.mtimeMs > cachedStats.mtimeMs) {
            skippedFiles.push(file.relPath);
            continue;
          }
        }

        ensureDir(path.dirname(destPath));
        if (copyIfChanged(file.absPath, destPath)) {
          restoredFiles.push(file.relPath);
        }
      } catch (err) {
        saveLog.error('Failed to restore save file', { savePath: file.absPath, error: (err as Error)?.message ?? err });
      }
    }

    for (const { root, relPath } of collectEmptyDirs(game, "cache")) {
      ensureDir(path.join(root.dir, relPath));
    }

    saveLog.info('Restore complete', {
      count: restoredFiles.length,
      files: restoredFiles.slice(0, 20),
      skipped: skippedFiles.length,
    });
    return { success: true, restoredFiles };
  },

  /**
   * removes the saves rombox injected into directories it does not own
   */
  cleanupEphemeralSaves(game: Game): { removedFiles: string[]; keptFiles: string[] } {
    const saveLog = log.child({ gameId: game.id, title: game.title });
    const removedFiles: string[] = [];
    const keptFiles: string[] = [];

    for (const file of collectSaveFiles(game, "emulator")) {
      if (!file.root.ephemeral || !file.matched) continue;

      const cachedPath = path.join(file.root.cacheDir, file.relPath);

      if (!mirrors(file.absPath, cachedPath)) {
        keptFiles.push(file.relPath);
        continue;
      }

      try {
        fs.unlinkSync(file.absPath);
        removedFiles.push(file.relPath);
      } catch (err) {
        keptFiles.push(file.relPath);
        saveLog.warn('Could not remove injected save', {
          savePath: file.absPath,
          error: (err as Error)?.message ?? err,
        });
      }
    }

    if (removedFiles.length || keptFiles.length) {
      saveLog.info('Injected saves cleaned up', {
        removed: removedFiles.length,
        kept: keptFiles.length,
        files: removedFiles.slice(0, 20),
      });
    }

    return { removedFiles, keptFiles };
  },

  deleteCachedSave(game: Game): { success: boolean; deletedFiles: string[]; error?: string } {
    log.info('Deleting cached saves', { gameId: game.id, title: game.title });

    const cachedSaves = collectSaveFiles(game, "cache");
    const deletedFiles: string[] = [];
    let keptShared = 0;

    for (const file of cachedSaves) {
      if (!file.matched) {
        keptShared++;
        continue;
      }

      try {
        fs.unlinkSync(file.absPath);
        deletedFiles.push(file.relPath);
      } catch (err) {
        log.warn('Failed to delete save file', { savePath: file.absPath, error: (err as Error)?.message ?? err });
      }
    }

    log.info('Cached saves deleted', { count: deletedFiles.length, files: deletedFiles, keptShared });
    return { success: true, deletedFiles };
  },

  async importSave(game: Game, sourcePath?: string): Promise<{
    success: boolean;
    importedFiles?: string[];
    replacedTo?: string;
    error?: string;
    issues?: SaveImportIssue[];
  }> {
    const importLog = log.child({ gameId: game.id, title: game.title });
    const roots = getSaveRoots(game, SAVE_CACHE_PATH);
    let chosenPath = sourcePath;

    if (!chosenPath) {
      const result = await dialog.showOpenDialog({
        title: `Import Save Data for ${game.title}`,
        properties: ["openFile"],
        filters: [
          { name: "Save Files", extensions: importableExtensions(roots) },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "Import cancelled" };
      }

      chosenPath = result.filePaths[0];
    }

    importLog.info('Validating save for import', { sourcePath: chosenPath });

    const planResult: ImportPlanResult = (() => {
      try {
        return planImport(game, chosenPath, roots);
      } catch (err) {
        importLog.error('Save validation failed', err);
        return {
          status: "rejected",
          rejections: [{
            file: path.basename(chosenPath),
            reason: (err as Error)?.message ?? "the file could not be read",
          }],
        };
      }
    })();

    if (planResult.status === "rejected") {
      const { rejections } = planResult;
      importLog.warn('Save rejected', { rejections: rejections.slice(0, 10) });
      return {
        success: false,
        error: describeRejections(rejections),
        issues: rejections,
      };
    }

    const { plan } = planResult;
    importLog.info('Save verified', {
      files: plan.entries.length,
      formats: [...new Set(plan.entries.map(e => e.verifiedAs))],
    });

    try {
      const replacedTo = snapshotReplacedFiles(game, plan);
      const importedFiles = installPlan(plan);

      importLog.info('Import complete', { count: importedFiles.length, replacedTo });
      return { success: true, importedFiles, replacedTo };
    } catch (err) {
      importLog.error('Import failed while writing', err);
      return { success: false, error: (err as Error)?.message ?? "Could not write the save data" };
    }
  },

  listAllSaves(): SaveStatus[] {
    ensureDir(SAVE_CACHE_PATH);

    const saves: SaveStatus[] = [];

    const walkCache = (dir: string, prefix: string, out: string[]) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const relPath = prefix ? path.join(prefix, entry.name) : entry.name;
        if (entry.isDirectory()) {
          walkCache(path.join(dir, entry.name), relPath, out);
        } else if (entry.isFile() && entry.name !== ".DS_Store") {
          out.push(relPath);
        }
      }
    };

    try {
      const consoleDirs = fs.readdirSync(SAVE_CACHE_PATH, { withFileTypes: true });

      for (const consoleDir of consoleDirs) {
        if (!consoleDir.isDirectory()) continue;
        if (consoleDir.name.startsWith(CACHE_INTERNAL_PREFIX)) continue;

        const consoleId = consoleDir.name as Game["consoleId"];
        const engineId = getEngineIdFromConsoleId(consoleId);
        if (!engineId) continue;

        const consoleCacheDir = getCacheDir(consoleId);
        const relPaths: string[] = [];
        walkCache(consoleCacheDir, "", relPaths);

        for (const relPath of relPaths) {
          const filePath = path.join(consoleCacheDir, relPath);
          let stats: fs.Stats;
          try {
            stats = fs.statSync(filePath);
          } catch {
            continue;
          }

          const fileName = path.basename(relPath);
          const romBasename = path.basename(fileName, path.extname(fileName));

          saves.push({
            gameId: romBasename,
            gameName: romBasename,
            gameFileName: fileName,
            consoleId,
            engineId,
            hasCachedSave: true,
            cachedFiles: [{
              gameId: romBasename,
              gameName: romBasename,
              gameFileName: fileName,
              consoleId,
              engineId,
              fileName: relPath,
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
    try {
      SaveService.backupSave(game);
    } catch (err) {
      log.warn('Pre-export backup failed', err);
    }

    const cachedSaves = collectSaveFiles(game, "cache");

    if (cachedSaves.length === 0) {
      log.warn('No cached saves found for this game');
      return { success: false, error: "No cached saves found for this game" };
    }

    const singleFile =
      cachedSaves.length === 1 && cachedSaves[0].root.scope === "per-game" ? cachedSaves[0] : null;
    const defaultName = singleFile
      ? path.basename(singleFile.absPath)
      : `${game.title.replace(/[^a-zA-Z0-9]/g, "_")}_saves.zip`;

    const result = await dialog.showSaveDialog({
      title: "Export Save File",
      defaultPath: path.join(app.getPath("downloads"), defaultName),
      filters: singleFile
        ? [{ name: "Save Files", extensions: [path.extname(singleFile.absPath).slice(1) || "sav"] }]
        : [{ name: "ZIP Archive", extensions: ["zip"] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: "Export cancelled" };
    }

    try {
      if (singleFile) {
        fs.copyFileSync(singleFile.absPath, result.filePath);
      } else {
        const zip = new AdmZip();

        for (const file of cachedSaves) {
          if (!fs.existsSync(file.absPath)) continue;

          const entryDir = path.dirname(path.join(file.root.id, file.relPath));
          zip.addLocalFile(file.absPath, entryDir === "." ? "" : entryDir.split(path.sep).join("/"));
        }

        for (const { root, relPath } of collectEmptyDirs(game, "cache")) {
          const entry = path.join(root.id, relPath).split(path.sep).join("/");
          zip.addFile(`${entry}/`, Buffer.alloc(0));
        }

        zip.writeZip(result.filePath);
      }

      return { success: true, exportedTo: result.filePath };
    } catch (err) {
      return { success: false, error: (err as Error)?.message ?? "Failed to export save" };
    }
  },
};
