import type { Game, IpcResponse, LibraryResponse } from "../../shared/types";
import { invoke, on } from "./invoke";

interface CoverResponse extends IpcResponse {
  coverPath?: string;
}

const failedCoverIds = new Set<string>();

export const gameClient = {
  getAll: () =>
    invoke<LibraryResponse | (IpcResponse & { games?: Game[] })>("game:getAll"),

  get: (id: string) =>
    invoke<IpcResponse & { game?: Game }>("game:get", id),

  update: (game: Game) =>
    invoke<IpcResponse & { game?: Game }>("game:update", game),

  relocate: (gameId: string, newPath?: string) =>
    invoke<IpcResponse & { game?: Game }>("game:relocate", gameId, newPath),

  delete: (gameId: string) =>
    invoke<IpcResponse>("game:delete", gameId),

  deleteAll: () =>
    invoke<IpcResponse>("game:deleteAll"),

  launch: (game: Game) =>
    invoke<IpcResponse>("game:launch", game),

  fetchCover: async (game: Game): Promise<CoverResponse> => {
    if (failedCoverIds.has(game.id)) {
      return { success: false, message: 'Cover previously failed to fetch' };
    }
    const result = await invoke<CoverResponse>("cover:fetch", game);
    if (!result.success || !result.coverPath) {
      failedCoverIds.add(game.id);
    }
    return result;
  },

  getCover: (game: Game) =>
    invoke<CoverResponse>("cover:get", game),

  clearCoverCache: () => failedCoverIds.clear(),

  onExited: (cb: () => void) => on('game-exited', (() => cb()) as never),
};
