import type { Game, IpcResponse, LibraryResponse } from "../../shared/types";

interface CoverResponse extends IpcResponse {
  coverPath?: string;
}

const failedCoverIds = new Set<string>();

export const gameClient = {
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

  fetchCover: async (game: Game): Promise<CoverResponse> => {
    if (failedCoverIds.has(game.id)) {
      return { success: false, message: 'Cover previously failed to fetch' };
    }
    const result = await window.electron.invoke("cover:fetch", game) as CoverResponse;
    if (!result.success || !result.coverPath) {
      failedCoverIds.add(game.id);
    }
    return result;
  },

  getCover: (game: Game) =>
    window.electron.invoke("cover:get", game) as Promise<CoverResponse>,
};
