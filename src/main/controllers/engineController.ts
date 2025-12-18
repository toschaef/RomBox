import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { homedir } from 'os';
import { app } from 'electron';
import { execSync } from 'child_process';
import { ENGINES } from '../engines';
import { dependencyController } from './dependencyController';
import { Platform, EngineDependency } from '../../shared/types';
import { findFile } from '../../shared/utils/fsUtils';

const BASE_PATH = path.join(app.getPath('userData'), 'engines');

const signFile = (filePath: string) => {
  console.log(`[Sign] Processing: ${path.basename(filePath)}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[Sign] ERROR: File not found at ${filePath}`);
    return;
  }

  // grant executable permission
  try {
    execSync(`chmod +x "${filePath}"`);
  } catch (e) {}

  try {
    // remove quarantine
    try {
      execSync(`xattr -d com.apple.quarantine "${filePath}"`, { stdio: 'pipe' });
      console.log(`[Sign] Removed quarantine flag.`);
    } catch (e: any) {
      if (!e.message.includes('No such xattr')) {
        console.log('[WARN] Quarantine removal:', e.message);
      }
    }

    // remove signatures
    try {
      execSync(`codesign --remove-signature "${filePath}"`, { stdio: 'ignore' });
      console.log(`[Sign] Stripped old signatures.`);
    } catch (e) {}

    // apply signature
    execSync(`codesign --force --sign - --preserve-metadata=entitlements "${filePath}"`);
    console.log(`[Sign] Successfully signed ${path.basename(filePath)}`);

  } catch (e: any) {
    console.error(`[Sign] CRITICAL FAILURE signing ${filePath}:`, e.message);
    throw e;
  }
};

const createJailbreakWrapper = (binaryPath: string) => {
  try {
    const binaryDir = path.dirname(binaryPath);
    const binaryName = path.basename(binaryPath);
    const realBinaryName = `${binaryName}.real`;
    const realBinaryPath = path.join(binaryDir, realBinaryName);

    if (fs.existsSync(realBinaryPath)) {
      console.log("[Wrapper] Binary already wrapped. Skipping.");
      return;
    }

    console.log(`[Wrapper] Renaming ${binaryName} to ${realBinaryName}...`);
    fs.renameSync(binaryPath, realBinaryPath);

    signFile(realBinaryPath);

    const scriptContent = 
      `#!/bin/bash
        DIR="$(cd "$(dirname "$0")" && pwd)"
        export DYLD_LIBRARY_PATH="$DIR:$DYLD_LIBRARY_PATH"
        exec "$DIR/${realBinaryName}" "$@"
      `.trim();

    console.log(`[Wrapper] Writing launcher script...`);
    fs.writeFileSync(binaryPath, scriptContent);
    execSync(`chmod +x "${binaryPath}"`);
    console.log("[Wrapper] Wrapper created successfully.");

  } catch (e: any) {
    console.error("[Wrapper] Failed:", e.message);
    try {
      const binaryDir = path.dirname(binaryPath);
      const realBinaryPath = path.join(binaryDir, `${path.basename(binaryPath)}.real`);
      if (fs.existsSync(realBinaryPath)) fs.renameSync(realBinaryPath, binaryPath);
    } catch (err) {}
  }
};

const getInstallPath = (consoleId: string) => {
  const config = ENGINES[consoleId];
  const dirName = config?.installDir || consoleId; 
  return path.join(BASE_PATH, dirName);
};

const getFirmwarePath = (consoleId: string) => {
  return path.join(homedir(), '.config', 'Mesen2', 'Firmware');
};

const getEnginePath = (consoleId: string) => {
  const config = ENGINES[consoleId];
  if (!config) return null;
  
  const platform = process.platform as Platform;
  const binaryRelPath = config.binaries[platform];
  if (!binaryRelPath) return null;

  const dirName = config.installDir || consoleId;
  const installBase = path.join(BASE_PATH, dirName);
  const strictPath = path.join(installBase, binaryRelPath);

  if (fs.existsSync(strictPath)) return strictPath;

  const binaryName = path.basename(binaryRelPath);
  console.log(`[EnginePath] Strict path failed. Searching for "${binaryName}" in ${installBase}...`);

  const foundPath = findFile(installBase, binaryName);
  
  if (foundPath) {
    console.log(`[EnginePath] Found binary at: ${foundPath}`);
    return foundPath;
  }

  return null;
};

export const engineController = {
  getInstallPath,
  getEnginePath,
  isInstalled: (consoleId: string) => getEnginePath(consoleId) !== null,

  installEngine: async (consoleId: string, onProgress: (status: string) => void) => {
    const config = ENGINES[consoleId];
    if (!config) throw new Error(`No engine config found for ${consoleId}`);

    const currentPlatform = process.platform as Platform;
    const downloadUrl = config.downloads[currentPlatform];
    const binaryRelPath = config.binaries[currentPlatform];

    if (!downloadUrl || !binaryRelPath) throw new Error(`Engine not supported on ${currentPlatform}`);

    console.log(`Starting install for ${config.name}...`);
    const installDir = getInstallPath(consoleId);
    const tempZipPath = path.join(installDir, 'temp_download.zip');

    if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true });
    fs.mkdirSync(installDir, { recursive: true });

    try {
      // download emulator
      onProgress(`Downloading emulator...`);
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'RomBox/1.0' },
        maxRedirects: 5
      });
      fs.writeFileSync(tempZipPath, response.data);

      console.log('Extracting engine...');
      const zip = new AdmZip(tempZipPath);
      zip.extractAllTo(installDir, true);
      fs.unlinkSync(tempZipPath);

      // handle evil nested zips
      const files = fs.readdirSync(installDir);
      const nestedZip = files.find(f => f.toLowerCase().endsWith('.zip'));
      if (nestedZip) {
        const nestedZipPath = path.join(installDir, nestedZip);
        const innerZip = new AdmZip(nestedZipPath);
        innerZip.extractAllTo(installDir, true);
        fs.unlinkSync(nestedZipPath);
      }

      let dependencyDir = installDir;
      let binaryFullPath = '';

      if (currentPlatform === 'darwin') {
        const appBundleName = binaryRelPath.split('/')[0];
        const foundAppPath = findFile(installDir, appBundleName);
        
        if (!foundAppPath) throw new Error(`Could not find ${appBundleName}`);

        const expectedPath = path.join(installDir, appBundleName);
        if (foundAppPath !== expectedPath) {
          console.log(`Moving ${appBundleName} to root...`);
          fs.renameSync(foundAppPath, expectedPath);
        }

        binaryFullPath = path.join(installDir, binaryRelPath);
        
        if (fs.existsSync(binaryFullPath)) {
          dependencyDir = path.dirname(binaryFullPath);
          // restore permissions just in case
          try {
            execSync(`xattr -rd com.apple.quarantine "${expectedPath}"`);
          } catch (e) {}
        }
      }

      // install dependencies
      if (config.dependencies) {
        const platformDeps = config.dependencies.filter((d: EngineDependency) => d.platform === currentPlatform);

        for (const dep of platformDeps) {
          onProgress(`Installing dependency: ${dep.filename}...`);
          await dependencyController.installDependency(dep, dependencyDir);

          // sign dependency
          if (currentPlatform === 'darwin') {
            const libPath = path.join(dependencyDir, dep.filename);
            signFile(libPath);
          }
        }

        if (currentPlatform === 'darwin' && binaryFullPath) {
          createJailbreakWrapper(binaryFullPath);
        }
      }

      console.log(`${config.name} installed successfully!`);
      return { success: true };

    } catch (err: any) {
      console.error(`Failed to install ${config.name}:`, err);
      return { success: false, error: err.message };
    }
  },

  isBiosInstalled: (consoleId: string): boolean => {
    const config = ENGINES[consoleId];
    if (!config?.bios) return true;

    // check primary location
    const primaryPath = path.join(homedir(), '.config', 'Mesen2', 'Firmware', config.bios.filename);
    if (fs.existsSync(primaryPath)) return true;

    // check fallback
    const secondaryPath = path.join(homedir(), 'Library', 'Application Support', 'Mesen2', 'Firmware', config.bios.filename);
    return fs.existsSync(secondaryPath);
  },
  installBios: (consoleId: string, sourcePath: string, zipEntryName?: string) => {
    const config = ENGINES[consoleId];
    if (!config?.bios) throw new Error("This console does not require a BIOS.");

    // We install to TWO locations to guarantee Mesen finds it.
    const targetDirs = [
      path.join(homedir(), '.config', 'Mesen2', 'Firmware'),
      path.join(homedir(), 'Library', 'Application Support', 'Mesen2', 'Firmware')
    ];

    let success = false;
    let lastError = null;

    for (const firmwareDir of targetDirs) {
      try {
        if (!fs.existsSync(firmwareDir)) {
          fs.mkdirSync(firmwareDir, { recursive: true });
        }

        const destPath = path.join(firmwareDir, config.bios.filename);
        console.log(`[BIOS] Installing to ${destPath}`);

        if (zipEntryName && path.extname(sourcePath).toLowerCase() === '.zip') {
          const zip = new AdmZip(sourcePath);
          const entry = zip.getEntry(zipEntryName);
          if (!entry) throw new Error(`Entry ${zipEntryName} not found in zip`);
          fs.writeFileSync(destPath, entry.getData());
        } else {
          fs.copyFileSync(sourcePath, destPath);
        }
        success = true;
      } catch (err: any) {
        console.warn(`[BIOS] Failed to install to ${firmwareDir}:`, err.message);
        lastError = err;
      }
    }

    if (!success && lastError) throw lastError;
    return { success: true };
  },
  clearEngines: () => {
    try {
      console.log("Clearing all engines and BIOS files...");

      // clear engines folder
      if (fs.existsSync(BASE_PATH)) {
        fs.rmSync(BASE_PATH, { recursive: true, force: true });
        fs.mkdirSync(BASE_PATH);
      }

      // clear bios and config files -- this only works for mac todo: fix that
      const systemPaths = [
        path.join(homedir(), '.config', 'Mesen2'),
        path.join(homedir(), 'Library', 'Application Support', 'Mesen2')
      ];

      for (const sysPath of systemPaths) {
        if (fs.existsSync(sysPath)) {
          console.log(`[Clear] Removing system folder: ${sysPath}`);
          fs.rmSync(sysPath, { recursive: true, force: true });
        }
      }

      return { success: true };
    } catch (err) { 
      console.error("Failed to clear engines:", err);
      throw err; 
    }
  },
};