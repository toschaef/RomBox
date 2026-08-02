import fs from "fs";
import path from "path";

import AdmZip from "adm-zip";

import type { Game } from "../../../shared/types";
import type { SaveImportIssue } from "../../../shared/types/saves";
import type { SaveRoot } from "../../config/saveLayouts";
import { matchFormatByExtension } from "../../config/saveFormats";
import { Logger } from "../logger";

const log = Logger.create("importPlanner");

/** Refuse to buffer anything larger than the biggest save medium RomBox supports. */
const MAX_IMPORT_BYTES = 512 * 1024 * 1024;

export interface ImportEntry {
  root: SaveRoot;
  /** where the file lands, relative to the root */
  relPath: string;
  buffer: Buffer;
  /** what proved this file is what it claims to be */
  verifiedAs: string;
}

export interface ImportPlan {
  entries: ImportEntry[];
  /** empty directories to recreate, as [root, relative path] pairs */
  directories: { root: SaveRoot; relPath: string }[];
  sourceName: string;
}

/** Rejections travel to the renderer as-is, so they share its type. */
export type ImportRejection = SaveImportIssue;

// A string discriminant, not a boolean one: this project compiles without
// strictNullChecks, where boolean literal types do not narrow a union.
export type ImportPlanResult =
  | { status: "verified"; plan: ImportPlan }
  | { status: "rejected"; rejections: ImportRejection[] };

function reject(file: string, reason: string): ImportPlanResult {
  return { status: "rejected", rejections: [{ file, reason }] };
}

function normalizeEntryPath(entryName: string): string {
  return entryName.split("\\").join("/");
}

/**
 * Rejects anything that would escape the destination root once joined -
 * archive entries are attacker-controlled input.
 */
function isContainedPath(relPath: string): boolean {
  if (relPath.length === 0) return false;
  if (path.isAbsolute(relPath)) return false;
  const normalized = path.normalize(relPath);
  return !normalized.startsWith("..") && !path.isAbsolute(normalized);
}

/**
 * Validates a file against the formats a root accepts. A file is only
 * accepted when a format it claims by extension verifies it; when no format
 * claims the extension, the root's structural patterns are the fallback for
 * emulated filesystems whose files have no signature of their own.
 */
function verifyAgainstRoot(
  root: SaveRoot,
  relPath: string,
  buffer: Buffer,
): { verifiedAs: string } | { reason: string } {
  const fileName = path.basename(relPath);
  const candidates = matchFormatByExtension(fileName, root.importFormats ?? []);

  if (candidates.length > 0) {
    const failures: string[] = [];

    for (const format of candidates) {
      const failure = format.validate(buffer);
      if (!failure) return { verifiedAs: format.label };
      failures.push(`${format.label}: ${failure}`);
    }

    return { reason: failures.join("; ") };
  }

  const matchesPattern = root.importPatterns?.some((pattern) => pattern.test(relPath));
  if (matchesPattern) return { verifiedAs: "save data in a verified location" };

  return { reason: `not a save file RomBox can verify for this console` };
}

/** Companion formats (clock dumps) may only ride along with a primary save. */
function isCompanionOnly(root: SaveRoot, fileName: string): boolean {
  const candidates = matchFormatByExtension(fileName, root.importFormats ?? []);
  return candidates.length > 0 && candidates.every((format) => format.companion);
}

function planSingleFile(game: Game, sourcePath: string, roots: SaveRoot[]): ImportPlanResult {
  const sourceName = path.basename(sourcePath);
  const stats = fs.statSync(sourcePath);

  if (stats.size === 0) return reject(sourceName, "the file is empty");
  if (stats.size > MAX_IMPORT_BYTES) {
    return reject(sourceName, "the file is far larger than any save this console uses");
  }

  const buffer = fs.readFileSync(sourcePath);
  const importable = roots.filter((root) => root.importFileName && root.importFormats?.length);

  if (importable.length === 0) {
    return reject(
      sourceName,
      "this console's saves can only be imported as a RomBox save archive (.zip)",
    );
  }

  const failures: string[] = [];

  for (const root of importable) {
    const nameFile = root.importFileName;
    if (!nameFile) continue;
    if (matchFormatByExtension(sourceName, root.importFormats ?? []).length === 0) continue;

    if (isCompanionOnly(root, sourceName)) {
      failures.push("clock data can only be imported inside an archive, next to its save file");
      continue;
    }

    const verdict = verifyAgainstRoot(root, sourceName, buffer);
    if ("reason" in verdict) {
      failures.push(verdict.reason);
      continue;
    }

    const named = nameFile({ game, sourceName, buffer });
    if ("rejected" in named) {
      failures.push(named.rejected);
      continue;
    }

    return {
      status: "verified",
      plan: {
        entries: [{ root, relPath: named.relPath, buffer, verifiedAs: verdict.verifiedAs }],
        directories: [],
        sourceName,
      },
    };
  }

  // No root even claimed the extension, so the file is not a save format
  // this console uses.
  if (failures.length === 0) {
    const extension = path.extname(sourceName);
    return reject(
      sourceName,
      extension
        ? `"${extension}" is not a save format this console uses`
        : "the file has no extension identifying it as a save",
    );
  }

  return reject(sourceName, failures.join("; "));
}

function planArchive(game: Game, sourcePath: string, roots: SaveRoot[]): ImportPlanResult {
  const sourceName = path.basename(sourcePath);

  let zip: AdmZip;
  try {
    zip = new AdmZip(sourcePath);
  } catch (err) {
    log.warn("Failed to open save archive", { sourcePath, error: (err as Error)?.message });
    return reject(sourceName, "the archive could not be opened");
  }

  const rootsById = new Map(roots.map((root) => [root.id, root]));
  const entries: ImportEntry[] = [];
  const directories: { root: SaveRoot; relPath: string }[] = [];
  const rejections: ImportRejection[] = [];
  const romBasename = path.basename(game.filePath, path.extname(game.filePath)).toLowerCase();

  for (const entry of zip.getEntries()) {
    const entryPath = normalizeEntryPath(entry.entryName);
    if (entryPath.startsWith("__MACOSX/") || path.basename(entryPath) === ".DS_Store") continue;

    if (!isContainedPath(entryPath)) {
      rejections.push({ file: entryPath, reason: "the archive entry points outside the save folder" });
      continue;
    }

    const [rootId, ...rest] = entryPath.replace(/\/+$/, "").split("/");
    const root = rootsById.get(rootId);
    const relPath = rest.join("/");

    if (!root) {
      rejections.push({ file: entryPath, reason: `"${rootId}" is not a save folder for this console` });
      continue;
    }

    if (relPath.length === 0) continue;

    if (entry.isDirectory) {
      directories.push({ root, relPath });
      continue;
    }

    // A per-game root holds one game's saves under its ROM's name; installing
    // another game's file there would leave it inert or shadow this game's.
    if (root.scope === "per-game" && !path.basename(relPath).toLowerCase().startsWith(romBasename)) {
      rejections.push({
        file: entryPath,
        reason: `belongs to a different game - import the save file on its own to attach it to "${game.title}"`,
      });
      continue;
    }

    const buffer = entry.getData();
    if (buffer.length > MAX_IMPORT_BYTES) {
      rejections.push({ file: entryPath, reason: "entry is far larger than any save this console uses" });
      continue;
    }

    const verdict = verifyAgainstRoot(root, relPath, buffer);
    if ("reason" in verdict) {
      rejections.push({ file: entryPath, reason: verdict.reason });
      continue;
    }

    entries.push({ root, relPath, buffer, verifiedAs: verdict.verifiedAs });
  }

  if (rejections.length > 0) return { status: "rejected", rejections };
  if (entries.length === 0) return reject(sourceName, "the archive holds no save data for this console");

  return { status: "verified", plan: { entries, directories, sourceName } };
}

/**
 * Builds the full set of files an import would write, verifying every one of
 * them first. Nothing is written here: the caller only proceeds when the
 * whole plan validates, so a bad file can never leave a half-finished import.
 */
export function planImport(game: Game, sourcePath: string, roots: SaveRoot[]): ImportPlanResult {
  if (!fs.existsSync(sourcePath)) {
    return reject(path.basename(sourcePath), "the file no longer exists");
  }

  return path.extname(sourcePath).toLowerCase() === ".zip"
    ? planArchive(game, sourcePath, roots)
    : planSingleFile(game, sourcePath, roots);
}
