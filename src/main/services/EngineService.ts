import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { homedir } from 'os';
import { ENGINES } from '../config/engines';
import { osHandler } from '../platform';
import { Platform } from '../../shared/types';
import { Extractor } from '../utils/extractor';
import { Downloader } from '../utils/downloader';

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
    } catch (err) {
      return null;
    }
  },

  installEngine: async (consoleId: string, onProgress: (s: string) => void) => {
    const config = ENGINES[consoleId];
    if (!config) throw new Error("Invalid Engine");

    const platform = process.platform as Platform;
    const url = config.downloads[platform];
    
    const installDir = path.join(BASE_PATH, config.installDir || consoleId);
    
    if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true });
    fs.mkdirSync(installDir, { recursive: true });

    try {
      onProgress('Downloading...');
      const customHeaders = (config as any).headers || {};

      const downloadedFilePath = await Downloader.download(url, installDir, {
        onProgress,
        headers: customHeaders
      });

      onProgress('Extracting...');
      const stats = fs.statSync(downloadedFilePath);
      if (stats.size < 1024 * 1024) throw new Error("Downloaded file is too small (invalid).");

      await osHandler.extractArchive(downloadedFilePath, installDir);
      fs.unlinkSync(downloadedFilePath);

      // handle nested archives
      const files = fs.readdirSync(installDir);
      // filter system files
      const validFiles = files.filter(f => !f.startsWith('.')); 
      
      const nestedArchive = validFiles.find(f => 
        ['.zip', '.7z', '.rar', '.tar', '.gz'].includes(path.extname(f).toLowerCase())
      );

      if (nestedArchive) {
         console.log(`[EngineService] Found nested archive: ${nestedArchive}`);
         const nestedPath = path.join(installDir, nestedArchive);
         
         await osHandler.extractArchive(nestedPath, installDir);
         
         fs.unlinkSync(nestedPath);
      }

      // install dependencies
      if (config.dependencies) {
        for (const dep of config.dependencies) {
           if (dep.platform !== platform) continue;
           
           onProgress(`Installing dependency: ${dep.sourceName || dep.filename}...`);
           
           const depPath = await Downloader.download(dep.url, installDir);

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
      const resolvedBinary = await osHandler.resolveBinaryPath(installDir, binaryConfigPath);
      
      const needsWrapper = config.dependencies && config.dependencies.length > 0;
      
      await osHandler.finalizeInstall(resolvedBinary, !!needsWrapper);

      return { success: true };
    } catch (err) {
      console.error("Install Failed:", err.message);
      return { success: false, message: err.message };
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

    } catch (err) {
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