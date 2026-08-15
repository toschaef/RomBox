import type {
  SaveGetStatusResponse,
  SaveBackupResponse,
  SaveRestoreResponse,
  SaveDeleteResponse,
  SaveListResponse,
  SaveExportResponse,
  SaveImportResponse,
} from "../../shared/types/saves";
import { invoke } from "./invoke";

export const saveClient = {
  getStatus: (gameId: string) => invoke<SaveGetStatusResponse>("save:status", { gameId }),

  backup: (gameId: string) => invoke<SaveBackupResponse>("save:backup", { gameId }),

  restore: (gameId: string) => invoke<SaveRestoreResponse>("save:restore", { gameId }),

  delete: (gameId: string) => invoke<SaveDeleteResponse>("save:delete", { gameId }),

  listAll: () => invoke<SaveListResponse>("save:list"),

  export: (gameId: string) => invoke<SaveExportResponse>("save:export", { gameId }),

  import: (gameId: string) => invoke<SaveImportResponse>("save:import", { gameId }),
};
