import { ipcMain } from 'electron';
import { gameController } from '../controllers/gameController';

export default function registerGameHandlers() {
  
  ipcMain.handle('create-game', async (event, fileInfo) => {
    try {
      console.log('Received file for creation:', fileInfo);
      return await gameController.createGame(fileInfo);
    } catch (err) {
      console.error('Failed to create game:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-games', async () => {
    try {
      return await gameController.getGames();
    } catch (err) {
      console.error('Failed to fetch games:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-game', async (event, id) => {
    try {
      return await gameController.getGame(id);
    } catch (err) {
      console.error('Failed to fetch games:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('update-game', async (event, game) => {
    try {
      return await gameController.updateGame(game);
    } catch (err) {
      console.error('Failed to update game:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('delete-game', async (event, gameId) => {
    try {
      return await gameController.deleteGame(gameId);
    } catch (err) {
      console.error('Failed to delete game:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('play-game', async (event, game) => {
    return gameController.playGame(game);
  });

  ipcMain.handle('clear-library', async () => {
    return gameController.clearLibrary();
  });

}