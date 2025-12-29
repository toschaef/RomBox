import { ipcMain } from 'electron';
import { LibraryService } from '../services/LibraryService';
import { LaunchService } from '../services/LaunchService';

export default function registerGameHandlers() {

  ipcMain.handle('game:getAll', async () => {
    try {
      return await LibraryService.getGames();
    } catch (err) {
      console.error('Failed to fetch games:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('game:get', async (event, id) => {
    try {
      return await LibraryService.getGame(id);
    } catch (err) {
      console.error('Failed to fetch games:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('game:update', async (event, game) => {
    try {
      return await LibraryService.updateGame(game);
    } catch (err) {
      console.error('Failed to update game:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('game:delete', async (event, gameId) => {
    try {
      return await LibraryService.deleteGame(gameId);
    } catch (err) {
      console.error('Failed to delete game:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('game:launch', async (event, game) => {
    return LaunchService.launch(game);
  });

  ipcMain.handle('game:deleteAll', async () => {
    return LibraryService.clearLibrary();
  });

}