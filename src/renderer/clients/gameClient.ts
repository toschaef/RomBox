import type { Game, IpcResponse, LibraryResponse } from "../../shared/types";

export type CreateGameRes = {
  success: boolean;
  game: Game;
  message?: undefined;
};

export const gameClient = {
  create: (fileInfo: CreateGameRes) =>
    window.electron.invoke("game:create", fileInfo) as Promise<IpcResponse & { game?: Game }>,

  getAll: () =>
    window.electron.invoke("game:getAll") as Promise<LibraryResponse | (IpcResponse & { games?: Game[] })>,

  get: (id: string) =>
    window.electron.invoke("game:get", id) as Promise<IpcResponse & { game?: Game }>,

  update: (game: Game) =>
    window.electron.invoke("game:update", game) as Promise<IpcResponse & { game?: Game }>,

  delete: (gameId: string) =>
    window.electron.invoke("game:delete", gameId) as Promise<IpcResponse>,

  deleteAll: () =>
    window.electron.invoke("game:deleteAll") as Promise<IpcResponse>,

  launch: (game: Game) =>
    window.electron.invoke("game:launch", game) as Promise<IpcResponse>,
};
