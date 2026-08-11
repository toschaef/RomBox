// lookups derived from `./catalog.ts`
import type { ConsoleID } from "../types";
import type { EngineID } from "../types/engines";
import type { BiosFile } from "../types/bios";
import {
  CONSOLE_CATALOG,
  CONSOLE_IDS,
  ENGINE_CATALOG,
  ENGINE_IDS,
  type RomSignature,
} from "./catalog";

/** consoleId -> human-readable console name */
export const CONSOLEID_ENGLISH_MAP: Record<ConsoleID, string> = Object.fromEntries(
  CONSOLE_IDS.map((id) => [id, CONSOLE_CATALOG[id].displayName])
) as Record<ConsoleID, string>;

export const getConsoleNameFromId = (id: ConsoleID): string => CONSOLEID_ENGLISH_MAP[id];

/** consoleId -> the emulator that runs it */
export const getEngineIdFromConsoleId = (id: ConsoleID): EngineID => CONSOLE_CATALOG[id].engineId;

/** engineId -> every console that emulator runs */
export const getConsoleIdsForEngine = (engineId: EngineID): ConsoleID[] =>
  CONSOLE_IDS.filter((id) => CONSOLE_CATALOG[id].engineId === engineId);

/** consoleId -> human-readable emulator name, e.g. "gc" -> "Dolphin" */
export const getEmulatorNameFromConsoleID = (consoleId: ConsoleID): string =>
  ENGINE_CATALOG[CONSOLE_CATALOG[consoleId].engineId].displayName;

/** engineId -> human-readable emulator name */
export const getEmulatorNameFromEngineId = (engineId: EngineID): string =>
  ENGINE_CATALOG[engineId].displayName;

// extensions claimed by more than one console; these cannot identify a
// console on their own and fall through to header detection
const AMBIGUOUS_EXTENSIONS: ReadonlySet<string> = (() => {
  const counts = new Map<string, number>();
  for (const id of CONSOLE_IDS) {
    for (const ext of CONSOLE_CATALOG[id].extensions) {
      counts.set(ext, (counts.get(ext) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([ext]) => ext));
})();

export const isAmbiguousExtension = (ext: string): boolean =>
  AMBIGUOUS_EXTENSIONS.has(ext.toLowerCase());

/** extension -> console, for extensions that identify a console outright */
export const EXTENSION_MAP: Record<string, ConsoleID> = (() => {
  const out: Record<string, ConsoleID> = {};
  for (const id of CONSOLE_IDS) {
    for (const ext of CONSOLE_CATALOG[id].identifiedBy ?? []) {
      out[ext] = id;
    }
  }
  return out;
})();

export function getConsoleIdFromExtension(extension: string): ConsoleID | null | undefined {
  const ext = extension.toLowerCase();
  if (isAmbiguousExtension(ext)) return null;
  return EXTENSION_MAP[ext];
}

/** every extension the app accepts on a file drop, as an <input accept> string */
export const ACCEPTED_EXTENSIONS: string = [
  ...new Set(CONSOLE_IDS.flatMap((id) => CONSOLE_CATALOG[id].extensions)),
  ".zip",
  ".7z",
].join(",");

/** lowercased BIOS filename -> the console it belongs to */
export const BIOS_FILENAMES: Record<string, ConsoleID> = (() => {
  const out: Record<string, ConsoleID> = {};
  for (const id of CONSOLE_IDS) {
    for (const file of CONSOLE_CATALOG[id].bios?.files ?? []) {
      out[file.filename.toLowerCase()] = id;
    }
  }
  return out;
})();

export const getBiosConsole = (filename: string): ConsoleID | undefined =>
  BIOS_FILENAMES[filename.toLowerCase()];

export const getBiosFiles = (consoleId: ConsoleID): BiosFile[] =>
  CONSOLE_CATALOG[consoleId].bios?.files ?? [];

/** header signatures used to identify disc images, in catalog order */
export const SIGNATURES: Array<RomSignature & { id: ConsoleID }> = CONSOLE_IDS.flatMap((id) => {
  const sig = CONSOLE_CATALOG[id].signature;
  return sig ? [{ id, ...sig }] : [];
});

export { CONSOLE_IDS, ENGINE_IDS };
