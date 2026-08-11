import type { DirectoryBios } from "../types";

// azahar stores system data as directory trees, not BIOS files
export const azaharSystemBios: DirectoryBios = {
  dirs: ["nand", "sysdata", "sdmc"],
  sourceFolderName: "user",
  selectionHint: "Select the Azahar 'user' folder (must be named 'user').",
  incompleteMessage: "Invalid user folder (missing nand/sysdata/sdmc).",
};
