import type {
  SaveGetStatusResponse,
  SaveBackupResponse,
  SaveRestoreResponse,
  SaveDeleteResponse,
  SaveListResponse,
  SaveExportResponse,
} from "../../shared/types/saves";

export const saveClient = {
  getStatus: (gameId: string) =>
    window.electron.invoke("save:status", { gameId }) as Promise<SaveGetStatusResponse>,

  backup: (gameId: string) =>
    window.electron.invoke("save:backup", { gameId }) as Promise<SaveBackupResponse>,

  restore: (gameId: string) =>
    window.electron.invoke("save:restore", { gameId }) as Promise<SaveRestoreResponse>,

  delete: (gameId: string) =>
    window.electron.invoke("save:delete", { gameId }) as Promise<SaveDeleteResponse>,

  listAll: () =>
    window.electron.invoke("save:list") as Promise<SaveListResponse>,

  export: (gameId: string) =>
    window.electron.invoke("save:export", { gameId }) as Promise<SaveExportResponse>,
};
