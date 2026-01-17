import { ipcMain } from "electron";
import { BiosService } from "../services/BiosService";
import type { ConsoleID } from "../../shared/types";

function isConsoleId(x: any): x is ConsoleID {
  return typeof x === "string" && x.length > 0;
}

export default function registerBiosHandlers() {
  ipcMain.handle("bios:install", async (_evt, payload: { consoleId: ConsoleID; filePath: string }) => {
    try {
      const { consoleId, filePath } = payload;
      if (!isConsoleId(consoleId)) return { success: false, message: "Invalid consoleId" };
      if (typeof filePath !== "string" || filePath.length === 0) return { success: false, message: "Invalid filePath" };

      return await BiosService.installBios(consoleId, filePath);
    } catch (err) {
      console.error("Failed to install BIOS:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("bios:get", async () => {
    try {
      return { success: true, items: BiosService.getAllBiosStatus() };
    } catch (err) {
      console.error("Failed to get BIOS status:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("bios:delete", async (_evt, payload: { consoleId: ConsoleID; fileName: string }) => {
    try {
      const { consoleId, fileName } = payload;
      if (!isConsoleId(consoleId)) return { success: false, message: "Invalid consoleId" };
      if (typeof fileName !== "string" || fileName.length === 0) return { success: false, message: "Invalid fileName" };

      return await BiosService.deleteBios(consoleId, fileName);
    } catch (err) {
      console.error("Failed to delete BIOS:", err.message);
      return { success: false, message: err.message };
    }
  });
}