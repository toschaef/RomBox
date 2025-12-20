import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { homedir } from 'os';
import { PlatformHandler } from './types';
import { findFile } from '../utils/fsUtils';

export class MacHandler implements PlatformHandler {
  
  async installDependency(dmgPath: string, installDir: string, searchName: string, targetFilename: string): Promise<void> {
    console.log(`[Mac] Mounting DMG to find ${searchName}`);
    let mountPoint: string;

    try {
      const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`).toString();
      mountPoint = mountOutput.match(/\/Volumes\/[^\n\r]*/)?.[0].trim() || '';
      if (!mountPoint) throw new Error("Could not mount DMG");
    } catch (e: any) { 
      throw new Error(`Failed to mount DMG: ${e.message}`); 
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
      try { execSync(`hdiutil detach "${mountPoint}" -force`); } catch(e){}
    }
  }

  async finalizeInstall(binaryPath: string): Promise<void> {
    if (!fs.existsSync(binaryPath)) return;

    if (fs.statSync(binaryPath).isDirectory()) return;

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
      // rename
      fs.renameSync(binaryPath, realBinaryPath);

      // create wrapper
      const scriptContent = [
        `#!/bin/bash`,
        `DIR="$(cd "$(dirname "$0")" && pwd)"`,
        `export DYLD_LIBRARY_PATH="$DIR:$DYLD_LIBRARY_PATH"`,
        `exec "$DIR/${realBinaryName}" "$@"`
      ].join('\n');

      fs.writeFileSync(binaryPath, scriptContent);

      // make executabe
      fs.chmodSync(binaryPath, '755');
      fs.chmodSync(realBinaryPath, '755');

      // sign
      await this.removeQuarantine(realBinaryPath);
      await this.adHocSign(realBinaryPath);
      
      console.log("[Mac] Wrapper created successfully");
    } catch (e) {
      console.warn("[Mac] Wrapper creation failed", e);
      // revert
      if (fs.existsSync(realBinaryPath) && !fs.existsSync(binaryPath)) {
        fs.renameSync(realBinaryPath, binaryPath);
      }
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

  private async removeQuarantine(filePath: string) {
    try { execSync(`xattr -d com.apple.quarantine "${filePath}"`, { stdio: 'ignore' }); } catch (e) {}
  }
  private async adHocSign(filePath: string) {
    try {
      try { execSync(`codesign --remove-signature "${filePath}"`, { stdio: 'ignore' }); } catch(e) {}
      execSync(`codesign --force --sign - --preserve-metadata=entitlements "${filePath}"`);
    } catch (e) {}
  }
}