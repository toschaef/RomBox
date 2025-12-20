import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { homedir } from 'os';
import { ENGINES } from '../config/engines';
import { osHandler } from '../platform';
import { Platform } from '../../shared/types';
import { Extractor } from '../utils/extractor';

const BASE_PATH = path.join(app.getPath('userData'), 'engines');

export const EngineService = {
  getEnginePath: async (consoleId: string) => {
    const config = ENGINES[consoleId];
    if (!config) return null;
    
    const platform = process.platform as Platform;
    const binaryConfigPath = config.binaries[platform];
    const dirName = config.installDir || consoleId;
    const installBase = path.join(BASE_PATH, dirName);
    
    try {
      return await osHandler.resolveBinaryPath(installBase, binaryConfigPath);
    } catch (e) {
      return null;
    }
  },

  installEngine: async (consoleId: string, onProgress: (s: string) => void) => {
    const config = ENGINES[consoleId];
    if (!config) throw new Error("Invalid Engine");

    const platform = process.platform as Platform;
    const url = config.downloads[platform];
    const installDir = path.join(BASE_PATH, config.installDir || consoleId);
    const tempZip = path.join(installDir, 'temp.zip');

    // install
    if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true });
    fs.mkdirSync(installDir, { recursive: true });

    try {
      onProgress(`Downloading ${config.name}...`);
      const res = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'RomBox/1.0' } });
      fs.writeFileSync(tempZip, res.data);

      onProgress('Extracting...');
      if (url.endsWith('.zip')) {
        const zip = new AdmZip(tempZip);
        zip.extractAllTo(installDir, true);
      } else if (url.endsWith('.tar.gz')) {
        await Extractor.extract7z(tempZip, installDir); 
      }
      fs.unlinkSync(tempZip);

      // handle nested zips
      const files = fs.readdirSync(installDir);
      const nestedZip = files.find(f => f.toLowerCase().endsWith('.zip'));
      if (nestedZip) {
         const nestedPath = path.join(installDir, nestedZip);
         const zip = new AdmZip(nestedPath);
         zip.extractAllTo(installDir, true);
         fs.unlinkSync(nestedPath);
      }

      // install dependencies
      if (config.dependencies) {
        for (const dep of config.dependencies) {
           if (dep.platform !== platform) continue;
           onProgress(`Installing dependency: ${dep.filename}...`);
           
           const depPath = path.join(installDir, dep.filename);
           const dRes = await axios.get(dep.url, { responseType: 'arraybuffer' });
           fs.writeFileSync(depPath, dRes.data);

           await osHandler.installDependency(
             depPath, 
             installDir, 
             dep.sourceName || dep.filename,
             dep.filename
           );
           
           fs.unlinkSync(depPath);
        }
      }

      // finalize
      const binaryConfigPath = config.binaries[platform];
      try {
        const resolvedBinary = await osHandler.resolveBinaryPath(installDir, binaryConfigPath);
        await osHandler.finalizeInstall(resolvedBinary);
      } catch (e) {
        console.warn("Could not finalize install:", e);
      }

      return { success: true };

    } catch (e: any) {
      console.error("Install Failed:", e);
      return { success: false, message: e.message };
    }
  },

  isBiosInstalled: (consoleId: string): boolean => {
    const config = ENGINES[consoleId];
    if (!config?.bios) return true;

    const firmwareDir = config.bios.installDir || 
      path.join(homedir(), '.config', 'Mesen2', 'Firmware');

    return config.bios.files.every(file => 
      fs.existsSync(path.join(firmwareDir, file.filename))
    );
  },
  installBios: (consoleId: string, sourcePath: string) => {
    const config = ENGINES[consoleId];
    if (!config?.bios) throw new Error("This console does not require a BIOS.");

    const targetDirs = config.bios.installDir 
      ? [config.bios.installDir] 
      : [
          path.join(homedir(), '.config', 'Mesen2', 'Firmware'),
          path.join(homedir(), 'Library', 'Application Support', 'Mesen2', 'Firmware')
        ];

    let installedFiles: string[] = [];

    for (const dir of targetDirs) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    try {
      const isZip = path.extname(sourcePath).toLowerCase() === '.zip';

      if (isZip) {
        const zip = new AdmZip(sourcePath);
        const zipEntries = zip.getEntries();

        for (const biosFile of config.bios.files) {
          const entry = zipEntries.find(e => 
            e.name.toLowerCase() === biosFile.filename.toLowerCase()
          );

          if (entry) {
            for (const dir of targetDirs) {
              fs.writeFileSync(path.join(dir, biosFile.filename), entry.getData());
            }
            installedFiles.push(biosFile.filename);
          }
        }
      } else {
        const sourceFilename = path.basename(sourcePath).toLowerCase();
        const matchedConfig = config.bios.files.find(f => 
          f.filename.toLowerCase() === sourceFilename
        );

        if (matchedConfig) {
          for (const dir of targetDirs) {
            fs.copyFileSync(sourcePath, path.join(dir, matchedConfig.filename));
          }
          installedFiles.push(matchedConfig.filename);
        } else {
          throw new Error(`File '${path.basename(sourcePath)}' is not a valid BIOS for ${consoleId}`);
        }
      }

      if (installedFiles.length === 0) {
        throw new Error("No valid BIOS files found in selection.");
      }
      return { success: true, installed: installedFiles };

    } catch (err: any) {
      console.error(`[BIOS] Installation failed:`, err.message);
      throw err;
    }
  },
  clearEngines: () => {
    try {
      console.log("Clearing all engines and BIOS files...");
      if (fs.existsSync(BASE_PATH)) {
        fs.rmSync(BASE_PATH, { recursive: true, force: true });
        fs.mkdirSync(BASE_PATH);
      }
      
      osHandler.clearPlatformData();
      
      return { success: true };
    } catch (err) { 
      console.error("Failed to clear engines:", err);
      throw err; 
    }
  },
};