import fs from "fs";
import path from "path";

import type { ConsoleID } from "../../../shared/types";
import type { BiosFile, BiosStatus } from "../../../shared/types/bios";
import type { DirectoryBios } from "../../emulators";
import { getEngineIdFromConsoleId } from "../../../shared/emulators/derived";

// shared BIOS status computation

export interface BiosDirs {
  firmwareDir: string;
  cacheDir: string;
}

export interface StatusInput extends BiosDirs {
  consoleId: ConsoleID;
  /** every file the catalog lists for this console */
  files: BiosFile[];
  required: boolean;
  onlyNeedOne: boolean;
  /** files that must be present */
  requiredFiles: BiosFile[];
  /** files whose absence is only a warning */
  warningFiles: BiosFile[];
  // set when this particular game needs its required files regardless of the
  forceRequired?: boolean;
}

const exists = (dir: string, name: string) => fs.existsSync(path.join(dir, name));

export function computeBiosStatus(input: StatusInput): BiosStatus {
  const { consoleId, files, required, onlyNeedOne, firmwareDir, cacheDir } = input;

  const effectiveRequired = input.forceRequired
    ? input.requiredFiles
    : required
      ? input.requiredFiles
      : [];
  const effectiveWarning = input.forceRequired
    ? input.warningFiles
    : required
      ? input.warningFiles
      : files;

  const hasAnyInstalled = files.some((f) => exists(firmwareDir, f.filename));
  const hasAnyCached = files.some((f) => exists(cacheDir, f.filename));

  let missingRequiredFiles: string[] = [];
  let missingWarningFiles: string[] = [];
  let cacheMissingFiles: string[] = [];

  if (onlyNeedOne) {
    // any one regional dump satisfies the console, so a partial set is not a
    // shortfall — either something is installed or nothing is.
    const allNames = files.map((f) => f.filename);

    if (!hasAnyInstalled) {
      if (required) missingRequiredFiles = allNames;
      else missingWarningFiles = allNames;
    }
    if (!hasAnyCached && required) cacheMissingFiles = allNames;
  } else {
    const missingFrom = (dir: string, list: BiosFile[]) =>
      list.filter((f) => !exists(dir, f.filename)).map((f) => f.filename);

    missingRequiredFiles = missingFrom(firmwareDir, effectiveRequired);
    missingWarningFiles = missingFrom(firmwareDir, effectiveWarning);
    cacheMissingFiles = missingFrom(cacheDir, effectiveRequired);
  }

  return {
    consoleId,
    engineId: getEngineIdFromConsoleId(consoleId),
    needsBios: onlyNeedOne ? required : input.forceRequired || effectiveRequired.length > 0,
    biosState: resolveState({
      fileCount: files.length,
      onlyNeedOne,
      required,
      hasAnyInstalled,
      missingRequiredFiles,
      missingWarningFiles,
    }),
    missingRequiredFiles,
    missingWarningFiles,
    cachedFiles: files.filter((f) => exists(cacheDir, f.filename)).map((f) => f.filename),
    cachedComplete: cacheMissingFiles.length === 0,
    cacheMissingFiles,
    required,
    onlyNeedOne,
    firmwareDir,
    cacheDir,
  };
}

function resolveState(args: {
  fileCount: number;
  onlyNeedOne: boolean;
  required: boolean;
  hasAnyInstalled: boolean;
  missingRequiredFiles: string[];
  missingWarningFiles: string[];
}): BiosStatus["biosState"] {
  if (args.fileCount === 0) return "none";

  if (args.onlyNeedOne) {
    if (args.hasAnyInstalled) return "ok";
    return args.required ? "missing" : "warning";
  }

  if (args.missingRequiredFiles.length > 0) return "missing";
  if (args.missingWarningFiles.length > 0) return "warning";
  return "ok";
}

/** The status of a console whose catalog entry declares no BIOS at all. */
export function noBiosStatus(consoleId: ConsoleID, dirs: BiosDirs): BiosStatus {
  return {
    consoleId,
    engineId: getEngineIdFromConsoleId(consoleId),
    needsBios: false,
    biosState: "none",
    missingRequiredFiles: [],
    missingWarningFiles: [],
    cachedFiles: [],
    cachedComplete: true,
    cacheMissingFiles: [],
    required: false,
    ...dirs,
  };
}

export function directoryBiosStatus(
  consoleId: ConsoleID,
  layout: DirectoryBios,
  dirs: BiosDirs
): BiosStatus {
  const missing = layout.dirs.filter((name) => !exists(dirs.firmwareDir, name));

  return {
    consoleId,
    engineId: getEngineIdFromConsoleId(consoleId),
    needsBios: true,
    biosState: missing.length ? "warning" : "ok",
    missingRequiredFiles: [],
    missingWarningFiles: missing,
    cachedFiles: layout.dirs.filter((name) => exists(dirs.cacheDir, name)),
    cachedComplete: true,
    cacheMissingFiles: [],
    required: false,
    ...dirs,
  };
}
