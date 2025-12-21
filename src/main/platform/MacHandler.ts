import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { homedir } from 'os';
import { PlatformHandler } from './types';
import { findFile } from '../utils/fsUtils';
import { Extractor } from '../utils/extractor';
import { spawn, ChildProcess } from 'child_process';

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
        } 
        else if (stat.isDirectory() && !stat.isSymbolicLink()) {
             results = results.concat(this.findAllAppBundles(fullPath));
        }
      }
    } catch (err) {}
    return results;
  }

async extractArchive(filePath: string, destDir: string): Promise<void> {
    const lowerExt = path.extname(filePath).toLowerCase();

    // handle dmg
    if (lowerExt === '.dmg') {
      console.log(`[Mac] Detected DMG. Mounting: ${filePath}`);
      const mountPoint = path.join(path.dirname(filePath), `mount_${Date.now()}`);

      try {
        // mount dmgs
        execSync(`hdiutil attach -nobrowse -noautoopen -mountpoint "${mountPoint}" "${filePath}"`);

        const appBundles = this.findAllAppBundles(mountPoint);
        
        if (appBundles.length === 0) {
          throw new Error('No .app bundle found inside DMG.');
        }

        // copy every app
        for (const appPath of appBundles) {
            const appName = path.basename(appPath);
            console.log(`[Mac] Copying ${appName} to ${destDir}`);

            execSync(`cp -R "${appPath}" "${destDir}/"`);
        }

      } catch (err) {
        throw new Error(`Failed to extract DMG: ${err.message}`);
      } finally {
        // detach
        if (fs.existsSync(mountPoint)) {
          try { execSync(`hdiutil detach "${mountPoint}" -force`); } catch(err) {}
        }
      }
      return;
    }

    // handle zip
    if (lowerExt === '.zip') {
      console.log(`[Mac] Extracting Zip: ${filePath}`);
      const zip = new AdmZip(filePath);
      zip.extractAllTo(destDir, true);
      return;
    }

    // handle other archive
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

      console.log(`[Mac] Copying ${foundPath} to ${destPath}`);

      if (fs.statSync(foundPath).isDirectory()) {
         const binaryInside = findFile(foundPath, searchName);
         if (binaryInside) {
             fs.copyFileSync(binaryInside, destPath);
         } else {
             throw new Error("Found directory but could not find binary inside it");
         }
      } else {
         fs.copyFileSync(foundPath, destPath);
      }

      await this.removeQuarantine(destPath);
      await this.adHocSign(destPath)
    } finally {
      try { execSync(`hdiutil detach "${mountPoint}" -force`); } catch(err){}
    }
  }

  async finalizeInstall(binaryPath: string, needsWrapper: boolean): Promise<void> {
    if (!fs.existsSync(binaryPath)) return;

    try { fs.chmodSync(binaryPath, '755'); } catch (e) {}

    const appBundleMatch = binaryPath.match(/(.*\.app)/);
    
    if (appBundleMatch) {
      const appPath = appBundleMatch[1];
      console.log(`[Mac] Detected App Bundle: ${appPath}`);

      await this.removeQuarantine(appPath);
      await this.deepSign(appPath);
      
      return;
    }

    console.log(`[Mac] Finalizing standalone binary: ${binaryPath}`);
    await this.removeQuarantine(binaryPath);
    await this.adHocSign(binaryPath);

    if (!needsWrapper) {
      return;
    }

    console.log(`[Mac] Finalizing wrapper for: ${binaryPath}`);

    const binaryDir = path.dirname(binaryPath);
    const binaryName = path.basename(binaryPath);
    const realBinaryName = `${binaryName}.real`;
    const realBinaryPath = path.join(binaryDir, realBinaryName);

    if (fs.existsSync(realBinaryPath)) {
      await this.adHocSign(realBinaryPath);
      return;
    }

    try {
      fs.renameSync(binaryPath, realBinaryPath);
      const scriptContent = [
        `#!/bin/bash`,
        `DIR="$(cd "$(dirname "$0")" && pwd)"`,
        `export DYLD_LIBRARY_PATH="$DIR:$DYLD_LIBRARY_PATH"`,
        `exec "$DIR/${realBinaryName}" "$@"`
      ].join('\n');

      fs.writeFileSync(binaryPath, scriptContent);
      fs.chmodSync(binaryPath, '755');
      fs.chmodSync(realBinaryPath, '755');
      await this.removeQuarantine(realBinaryPath);
      await this.adHocSign(realBinaryPath);
    } catch (err) {
      console.warn("[Mac] Wrapper failed", err);
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

    if (binaryPath.includes('.app/Contents/MacOS/')) {
      const appPath = binaryPath.split('.app/')[0] + '.app';

      const openArgs = [
        '-a', appPath,
        '--args',
        ...args
      ];
      
      console.log(`[Mac] Opening App Bundle: ${appPath}`);
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
    } catch {}
  }
  private async adHocSign(filePath: string) {
    try {
      try { execSync(`codesign --remove-signature "${filePath}"`, { stdio: 'ignore' }); } catch(err) {}
      execSync(`codesign --force --sign - --preserve-metadata=entitlements "${filePath}"`);
    } catch (err) {}
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