import { BrowserWindow, dialog, ipcMain } from "electron";
import { ImportService } from "../services/ImportService";

export default function registerImportHandlers() {
  ipcMain.handle("process-file-drop", async (event, filePath: string) =>
    ImportService.importPath(filePath, (status) =>
      event.sender.send("install-status-update", status)
    )
  );

  ipcMain.handle("select-files-or-directories", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return [];

    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile", "openDirectory", "multiSelections"],
      title: "Select Games or BIOS Files/Folders",
      buttonLabel: "Import",
    });

    return result.canceled ? [] : result.filePaths;
  });
}
