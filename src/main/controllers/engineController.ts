import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { ENGINES, getEnginePath } from '../engines';

const ENGINES_DIR = path.join(app.getPath('userData'), 'engines');

export const engineController = {
  isInstalled: (consoleId: string): boolean => {
    const exePath = getEnginePath(consoleId);
    return exePath ? fs.existsSync(exePath) : false;
  },
  installEngine: async (consoleId: string) => {
    const config = ENGINES[consoleId];
    if (!config) throw new Error(`No engine config found for ${consoleId}`);

    console.log(`Starting install for ${config.name}...`);

    const installDir = path.join(ENGINES_DIR, config.id);
    const tempZipPath = path.join(installDir, 'temp_download.zip');

    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }

    try {
      // fetch zip
      const response = await axios({
        method: 'GET',
        url: config.downloadUrl,
        responseType: 'arraybuffer',
      });

      // write zip
      fs.writeFileSync(tempZipPath, response.data);
      console.log('Download complete. Extracting...');

      // unzip
      const zip = new AdmZip(tempZipPath);
      zip.extractAllTo(installDir, true);

      // delete zip
      fs.unlinkSync(tempZipPath);
      
      // fix quarantine permissions on mac
      if (process.platform === 'darwin') {
        const { execSync } = require('child_process');
        try {
            const appPath = path.join(installDir, 'Mesen.app');
            
            console.log(`Removing quarantine from: ${appPath}`);

            execSync(`xattr -rd com.apple.quarantine "${appPath}"`);
            execSync(`chmod +x "${path.join(appPath, 'Contents/MacOS/Mesen')}"`);
            
        } catch (e) {
            console.warn("Could not remove quarantine attribute (Mac specific).", e);
        }
      }

      console.log(`${config.name} installed successfully!`);
      return { success: true };

    } catch (err) {
      console.error(`Failed to install ${config.name}:`, err);
      return { success: false, error: err.message };
    }
  }
};