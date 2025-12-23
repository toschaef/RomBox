import { execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { homedir } from 'os';
import { PlatformHandler } from './types';
import { findFile } from '../utils/fsUtils';
import { Extractor } from '../utils/extractor';

export class MacHandler implements PlatformHandler {

  private findAllAppBundles(dir: string): string[] {
    let results: string[] = [];
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.lstatSync(fullPath);
        if (file.endsWith('.app')) {
          results.push(fullPath);
        } else if (stat.isDirectory() && !stat.isSymbolicLink()) {
             results = results.concat(this.findAllAppBundles(fullPath));
        }
      }
    } catch (err) {
      void err;
    }
    return results;
  }

  async extractArchive(filePath: string, destDir: string): Promise<void> {
    const lowerExt = path.extname(filePath).toLowerCase();

    if (lowerExt === '.dmg') {
      console.log(`[Mac] Detected DMG. Mounting: ${filePath}`);
      const mountPoint = path.join(path.dirname(filePath), `mount_${Date.now()}`);

      try {
        execSync(`hdiutil attach -nobrowse -noautoopen -mountpoint "${mountPoint}" "${filePath}"`);
        const appBundles = this.findAllAppBundles(mountPoint);
        
        if (appBundles.length === 0) throw new Error('No .app bundle found inside DMG.');

        for (const appPath of appBundles) {
            const appName = path.basename(appPath);
            console.log(`[Mac] Copying ${appName} to ${destDir}`);
            execSync(`cp -R "${appPath}" "${destDir}/"`);
        }
      } catch (err) {
        throw new Error(`Failed to extract DMG: ${err.message}`);
      } finally {
        if (fs.existsSync(mountPoint))
          try {
            execSync(`hdiutil detach "${mountPoint}" -force`);
          } catch (err) {
            void err;
          }
      }
      return;
    }

    if (lowerExt === '.zip') {
      console.log(`[Mac] Extracting Zip: ${filePath}`);
      const zip = new AdmZip(filePath);
      zip.extractAllTo(destDir, true);
      return;
    }

    if (['.7z', '.tar', '.gz', '.rar'].includes(lowerExt)) {
      console.log(`[Mac] Extracting with 7z: ${filePath}`);
      await Extractor.extract7z(filePath, destDir);
      return;
    }
    throw new Error(`Unsupported archive format for macOS: ${lowerExt}`);
  }
  
  async installDependency(dmgPath: string, installDir: string, searchName: string, targetFilename: string): Promise<void> {
    console.log(`[Mac] Mounting DMG to find ${searchName}`);
    let mountPoint: string;

    try {
      const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`).toString();
      mountPoint = mountOutput.match(/\/Volumes\/[^\n\r]*/)?.[0].trim() || '';
      if (!mountPoint) throw new Error("Could not mount DMG");
    } catch (err) { 
      throw new Error(`Failed to mount DMG: ${err.message}`); 
    }
    
    try {
      const foundPath = findFile(mountPoint, searchName);
      if (!foundPath) throw new Error(`Could not find ${searchName} in DMG`);

      const macOsDir = findFile(installDir, 'MacOS');
      const destDir = macOsDir || installDir;
      const destPath = path.join(destDir, targetFilename);

      console.log(`[Mac] Installing dependency to: ${destPath}`);

      if (fs.statSync(foundPath).isDirectory()) {
         const binaryInside = findFile(foundPath, searchName);
         if (binaryInside) fs.copyFileSync(binaryInside, destPath);
         else throw new Error("Found binary inside framework");
      } else {
         fs.copyFileSync(foundPath, destPath);
      }

      try {
        execSync(`install_name_tool -id "@executable_path/${targetFilename}" "${destPath}"`);
      } catch (err) {
        void err;
      }

      await this.removeQuarantine(destPath);
    } finally {
      try {
        execSync(`hdiutil detach "${mountPoint}" -force`);
      } catch (err) {
        void err;
      }
    }
  }

  async finalizeInstall(binaryPath: string, needsWrapper: boolean): Promise<void> {
    if (!fs.existsSync(binaryPath)) return;

    try {
      fs.chmodSync(binaryPath, '755');
    } catch (err) {
      void err;
    }

    const appBundleMatch = binaryPath.match(/(.*\.app)/);
    
    let targetBinary = binaryPath;
    let appPath = '';

    if (appBundleMatch) {
      appPath = appBundleMatch[1];
      console.log(`[Mac] Detected App Bundle: ${appPath}`);
      
      const mesenSupportDir = path.join(homedir(), 'Library', 'Application Support', 'Mesen2');
      if (fs.existsSync(mesenSupportDir)) {
          console.log("[Mac] Clearing old Mesen2 support files...");
          fs.rmSync(mesenSupportDir, { recursive: true, force: true });
      }

      if (fs.statSync(binaryPath).isDirectory()) {
         const macOsDir = path.join(binaryPath, 'Contents', 'MacOS');
         const bundleName = path.basename(binaryPath, '.app');
         targetBinary = path.join(macOsDir, bundleName);
      }
    }

    console.log(`[Mac] Finalizing binary: ${targetBinary}`);

    await this.removeQuarantine(targetBinary);
    await this.adHocSign(targetBinary);

    if (appBundleMatch || needsWrapper) {
        console.log(`[Mac] Applying Jailbreak Wrapper to: ${targetBinary}`);
        
        const binaryDir = path.dirname(targetBinary);
        const binaryName = path.basename(targetBinary);
        const realBinaryName = `${binaryName}.real`;
        const realBinaryPath = path.join(binaryDir, realBinaryName);

        if (fs.existsSync(realBinaryPath)) {
            console.log("[Mac] Wrapper already exists. Skipping.");
            return;
        }

        try {
            fs.renameSync(targetBinary, realBinaryPath);

            const scriptContent = [
                `#!/bin/bash`,
                `DIR="$(cd "$(dirname "$0")" && pwd)"`,
                `export DYLD_LIBRARY_PATH="$DIR:$DYLD_LIBRARY_PATH"`,
                `exec "$DIR/${realBinaryName}" "$@"`
            ].join('\n');

            fs.writeFileSync(targetBinary, scriptContent);
            
            fs.chmodSync(targetBinary, '755');
            fs.chmodSync(realBinaryPath, '755');

            await this.removeQuarantine(realBinaryPath);
            await this.adHocSign(realBinaryPath);
            
            console.log("[Mac] Wrapper created successfully.");
        } catch (err) {
            console.error(`[Mac] Failed to create wrapper: ${err.message}`);
        }
    }

    if (appPath) {
        await this.deepSign(appPath);
    }
  }

  async resolveBinaryPath(installDir: string, binaryConfigPath: string): Promise<string> {
    const strictPath = path.join(installDir, binaryConfigPath);
    if (fs.existsSync(strictPath)) return strictPath;

    const binaryName = path.basename(binaryConfigPath);
    const found = findFile(installDir, binaryName);
    
    if (!found) throw new Error(`Binary ${binaryName} not found in ${installDir}`);
    return found;
  }

  clearPlatformData(): void {
    const pathsToDelete = [
      path.join(homedir(), '.config', 'Mesen2'),
      path.join(homedir(), 'Library', 'Application Support', 'Mesen2'),
      path.join(homedir(), 'Library', 'Preferences', 'melonDS'),
      path.join(homedir(), 'Library', 'Preferences', 'azahar'),
    ];

    for (const p of pathsToDelete) {
      if (fs.existsSync(p)) {
        console.log(`[Mac] Cleaning config: ${p}`);
        fs.rmSync(p, { recursive: true, force: true });
      }
    }
  }

  launchProcess(binaryPath: string, args: string[]): ChildProcess {
    console.log(`[Mac] Launching: ${binaryPath}`);

    if (binaryPath.includes('.app')) {
      const match = binaryPath.match(/(.*\.app)/);
      if (!match) throw new Error(`Could not find app bundle in path: ${binaryPath}`);

      const appPath = match[1];
      const bundleName = path.basename(appPath, '.app');
      const wrapperPath = path.join(appPath, 'Contents', 'MacOS', bundleName);

      let isWrapper = false;
      try {
          const content = fs.readFileSync(wrapperPath, 'utf8');
          if (content.startsWith('#!/bin/bash')) isWrapper = true;
      } catch (err) {
        void err;
      }

      if (isWrapper) {
          console.log(`[Mac] Launching Wrapper Script directy: ${wrapperPath}`);
          return spawn(wrapperPath, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      }

      console.log(`[Mac] Opening App Bundle: ${appPath}`);
      const openArgs = ['-a', appPath, '--args', ...args];
      return spawn('open', openArgs, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    }

    return spawn(binaryPath, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  }


  getEmulatorConfigPath(emulatorId: string): string {
    const home = homedir();
    
    switch (emulatorId) {
      case 'dolphin':
        return path.join(home, 'Library', 'Application Support', 'Dolphin', 'Config');
      
      case 'mesen':
        return path.join(home, '.config', 'Mesen2');
      
      case 'ares':
        return path.join(home, 'Library', 'Application Support', 'ares');

      default:
        return path.join(home, 'Library', 'Application Support', emulatorId);
    }
  }

  // helpers

  private async removeQuarantine(filePath: string) {
    try { 
      execSync(`xattr -r -d com.apple.quarantine "${filePath}"`, { stdio: 'ignore' }); 
      console.log(`[Mac] Quarantine removed for: ${path.basename(filePath)}`);
    } catch (err) {
      void err;
    }
  }
  private async adHocSign(filePath: string) {
    try {
      try {
        execSync(`codesign --remove-signature "${filePath}"`, { stdio: 'ignore' });
      } catch (err) {
        void err;
      }
      execSync(`codesign --force --sign - --preserve-metadata=entitlements "${filePath}"`);
    } catch (err) {
      void err;
    }
  }

  private async deepSign(appPath: string) {
    console.log(`[Mac] Deep signing app bundle: ${appPath}`);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`);
      console.log(`[Mac] Deep sign successful.`);
    } catch (err) {
      console.error(`[Mac] Deep sign failed: ${err.message}`);
    }
  }
}