import { ipcMain } from 'electron';
import { LibraryService } from '../services/LibraryService';
import { LaunchService } from '../services/LaunchService';

export default function registerGameHandlers() {
  
  ipcMain.handle('create-game', async (event, fileInfo) => {
    try {
      console.log('Received file for creation:', fileInfo);
      return await LibraryService.createGameFromFile(fileInfo);
    } catch (err) {
      console.error('Failed to create game:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-games', async () => {
    try {
      return await LibraryService.getGames();
    } catch (err) {
      console.error('Failed to fetch games:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-game', async (event, id) => {
    try {
      return await LibraryService.getGame(id);
    } catch (err) {
      console.error('Failed to fetch games:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('update-game', async (event, game) => {
    try {
      return await LibraryService.updateGame(game);
    } catch (err) {
      console.error('Failed to update game:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('delete-game', async (event, gameId) => {
    try {
      return await LibraryService.deleteGame(gameId);
    } catch (err) {
      console.error('Failed to delete game:', err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('play-game', async (event, game) => {
    return LaunchService.launch(game);
  });

  ipcMain.handle('clear-library', async () => {
    return LibraryService.clearLibrary();
  });

}