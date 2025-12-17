import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import AdmZip from 'adm-zip';
import crypto from "crypto";
import type { Game } from "../../shared/types";
import { EXTENSION_MAP } from "../../shared/utils";

function getConsoleId(extension: string) {
  return EXTENSION_MAP[extension.toLowerCase()];
}

export function scrapeGameData(file: { name: string; path: string }): Game {
  let extension = path.extname(file.path).toLowerCase();
  let detectedConsoleId = getConsoleId(extension);

  if (extension === '.zip') {
    try {
      console.log(`Inspecting zip file: ${file.name}`);
      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();

      // greedily pick first valid rom inside the zip
      const validEntry = zipEntries.find((entry) => {
        if (entry.isDirectory) return false;
        const innerExt = path.extname(entry.name).toLowerCase();
        return getConsoleId(innerExt) !== undefined;
      });

      if (!validEntry) {
        throw new Error("No valid ROM file found inside the zip archive.");
      }

      console.log(`Found valid ROM inside zip: ${validEntry.name}`);
      
      const innerExt = path.extname(validEntry.name).toLowerCase();
      detectedConsoleId = getConsoleId(innerExt);

      file.name = validEntry.name; 

    } catch (err) {
      console.error("Failed to read zip:", err);
      throw new Error("Invalid or corrupted zip file.");
    }
  }

  if (!detectedConsoleId) {
    throw new Error(`Invalid or unsupported file extension: ${extension}`);
  }

  // regex to remove extension
  let title = file.name.replace(/\.[^/.]+$/, "");
  
  // regex to remove info in parentheses and brackets
  title = title
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/_/g, ' ')
    .trim();

  const userDataPath = app.getPath('userData');
  const romsDir = path.join(userDataPath, 'roms', detectedConsoleId);

  if (!fs.existsSync(romsDir)) {
    fs.mkdirSync(romsDir, { recursive: true });
  }

  const fileName = path.basename(file.path);
  const newFilePath = path.join(romsDir, fileName);

  try {
    if (file.path !== newFilePath) {
      console.log(`Copying ROM to library: ${newFilePath}`);
      fs.copyFileSync(file.path, newFilePath);
    }
  } catch (err) {
    console.error("Failed to copy ROM to library folder:", err);
    throw new Error("Could not import file into library.");
  }

  const gameData: Game = {
    id: crypto.randomUUID(),
    title: title, 
    filePath: newFilePath,
    consoleId: detectedConsoleId,
  };

  return gameData;
}