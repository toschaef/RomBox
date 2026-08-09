export const NOTIFICATION_MESSAGES = {
  // games
  GAME_INSTALLED: (title: string) => `${title} installed`,
  LAUNCH_FAILED: (gameTitle: string) => `Error launching ${gameTitle}`,
  GAME_DELETED: (gameTitle: string) => `${gameTitle} deleted`,
  DELETE_FAILED: (gameTitle: string) => `Error deleting ${gameTitle}`,
  SAVE_EXPORTED: (gameTitle: string) => `${gameTitle} save data exported`,
  SAVE_EXPORT_FAILED: (gameTitle: string) => `Error exporting ${gameTitle} save data`,
  SAVE_IMPORTED: (gameTitle: string, fileCount: number) =>
    `${fileCount} save file${fileCount === 1 ? '' : 's'} imported for ${gameTitle}`,
  SAVE_IMPORT_REJECTED: (reason: string) => `Save not imported - ${reason}`,
  SAVE_IMPORT_FAILED: (gameTitle: string) => `Error importing ${gameTitle} save data`,
  RENAME_FAILED: (gameTitle: string) => `Error renaming ${gameTitle}`,
  GAME_RELOCATED: (gameTitle: string) => `${gameTitle} location updated`,
  RELOCATE_FAILED: (gameTitle: string) => `Error updating the location of ${gameTitle}`,

  // bios
  BIOS_INSTALLED: (label: string) => `${label} installed`,
  BIOS_REMOVED: (fileName: string) => `${fileName} uninstalled`,

  // engines
  INSTALL_SUCCESS: (emulatorName: string) => `${emulatorName} installed`,
  INSTALL_FAILED: (emulatorName: string, error: string) => `Error installing ${emulatorName}: ${error}`,
  EMULATOR_INSTALLING: (emulatorName: string) => `Error: ${emulatorName} still installing`,
  ENGINE_INSTALLED: (displayName: string) => `${displayName} installed`,
  ENGINE_UNINSTALLED: (displayName: string) => `${displayName} uninstalled`,
  ENGINE_REPAIRED: (displayName: string) => `${displayName} repaired`,

  // useNotifications
  ITEM_SUCCEEDED: (label: string) => `${label} succeeded`,
  ITEM_FAILED: (label: string) => `${label} failed`,
  ITEMS_PROCESSED: (count: number) => `${count} items processed`,
  ITEMS_FAILED: (count: number) => `${count} items failed`,
  BULK_SUCCEEDED: (count: number) => `${count} succeeded`,
  BULK_FAILED: (count: number) => `${count} failed`,
  GAMES_AND_BIOS_INSTALLED: (parts: string) => `${parts} installed`,
  FILES_FAILED: (count: number) => `Error installing${count} file${count > 1 ? 's' : ''}`,

  ERROR_MESSAGE: (message: string) => message,
};