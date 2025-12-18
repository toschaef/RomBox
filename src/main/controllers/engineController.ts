import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { execSync } from 'child_process';
import { ENGINES } from '../engines';
import { dependencyController } from './dependencyController';
import { Platform, EngineDependency } from '../../shared/types';

const BASE_PATH = path.join(app.getPath('userData'), 'engines');

const findApp = (dir: string): string | null => {
  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (file.endsWith('.app')) return fullPath;

      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const found = findApp(fullPath);
          if (found) return found;
        }
      } catch (e: any) {
        // ignore permission errors
        if (e.code !== 'EACCES') console.warn(`[FindApp] Skip ${fullPath}: ${e.message}`);
      }
    }
  } catch (e) {}
  return null;
};

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

    // make wrapper executable
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

const getInstallPath = (consoleId: string) => path.join(BASE_PATH, consoleId);

const getEnginePath = (consoleId: string) => {
  const config = ENGINES[consoleId];
  if (!config) return null;
  const platform = process.platform as Platform;
  const binaryRelPath = config.binaries[platform];
  if (!binaryRelPath) return null;
  const fullPath = path.join(BASE_PATH, consoleId, binaryRelPath);
  return fs.existsSync(fullPath) ? fullPath : null;
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
        const foundAppPath = findApp(installDir);
        if (!foundAppPath) throw new Error("Could not find .app bundle.");

        const expectedPath = path.join(installDir, 'Mesen.app');
        if (foundAppPath !== expectedPath) {
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

  clearEngines: () => {
    try {
      if (fs.existsSync(BASE_PATH)) {
        fs.rmSync(BASE_PATH, { recursive: true, force: true });
        fs.mkdirSync(BASE_PATH);
      }
      return { success: true };
    } catch (err) { throw err; }
  },
};