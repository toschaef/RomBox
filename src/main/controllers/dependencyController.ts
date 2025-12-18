import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { EngineDependency } from '../../shared/types';
import { findFile } from '../../shared/utils';


export const dependencyController = {
  installDependency: async (config: EngineDependency, targetDir: string) => {
    const searchName = config.sourceName || config.filename;
    console.log(`Installing dependency. Searching for: "${searchName}", Saving as: "${config.filename}"`);
    
    const downloadPath = path.join(targetDir, 'temp_dependency_download');

    try {
      // download dependency
      const response = await axios({
        method: 'GET',
        url: config.url,
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'RomBox/1.0' }
      });
      fs.writeFileSync(downloadPath, response.data);

      // extract based on file type
      if (config.url.endsWith('.dmg')) {
        await installFromDmg(downloadPath, searchName, config.filename, targetDir);
      } else if (config.url.endsWith('.tar.gz')) {
        installFromTar(downloadPath, targetDir);
      } else {
        throw new Error(`Unsupported dependency format: ${path.extname(config.url)}`);
      }

      console.log(`Successfully installed ${config.filename}`);
    } catch (e) {
      console.error("Dependency installation failed:", e);
      throw e;
    } finally {
      if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
    }
  }
};

const installFromDmg = async (dmgPath: string, searchName: string, saveName: string, outputDir: string) => {
  console.log("Mounting DMG...");
  
  // mount dmg
  const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`).toString();
  const mountPointMatch = mountOutput.match(/\/Volumes\/[^\n\r]*/);
  
  if (!mountPointMatch) throw new Error("Could not mount DMG");
  
  const mountPoint = mountPointMatch[0].trim();
  
  try {
    console.log(`Searching for "${searchName}" in ${mountPoint}...`);
    
    // find file
    const foundPath = findFile(mountPoint, searchName);

    if (!foundPath) throw new Error(`Could not find file "${searchName}" inside DMG.`);

    const destPath = path.join(outputDir, saveName);
    console.log(`Found at ${foundPath}. Copying to ${destPath}...`);
    
    // copy and rename
    fs.copyFileSync(foundPath, destPath);

  } finally {
    console.log("Unmounting DMG...");
    try {
        execSync(`hdiutil detach "${mountPoint}" -force`);
    } catch (e) {
        // try again in 1s
        await new Promise(r => setTimeout(r, 1000));
        execSync(`hdiutil detach "${mountPoint}" -force`);
    }
  }
};

const installFromTar = (tarPath: string, outputDir: string) => {
    console.log("Extracting Tar...");
    execSync(`tar -xzf "${tarPath}" -C "${outputDir}"`);
};