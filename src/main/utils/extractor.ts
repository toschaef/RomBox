import { spawn } from 'child_process';
import sevenBin from '7zip-bin';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { extractZipEntry } from './fsUtils';

const pathTo7zip = sevenBin.path7za;

// fix permissions on load
if (process.platform !== 'win32') {
  try {
    if (fs.existsSync(pathTo7zip)) fs.chmodSync(pathTo7zip, '755');
  } catch (err) {
    void err;
  }
}

interface SevenZipEntry {
  file: string;
  size: string;
  attr?: string;
}

export const Extractor = {
  extractToFile: async (sourcePath: string, destPath: string, zipEntryName?: string): Promise<void> => {
    if (!zipEntryName) {
      if (sourcePath !== destPath) {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        
        fs.copyFileSync(sourcePath, destPath);
      }
      return;
    }

    console.log(`[Extractor] Extracting ${zipEntryName}...`);
    const ext = path.extname(sourcePath).toLowerCase();
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    if (ext === '.7z') {
      const tempDir = path.join(app.getPath('temp'), 'rombox_7z_' + crypto.randomUUID());
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
      
      try {
        await Extractor.extract7z(sourcePath, tempDir, zipEntryName);
        
        const extractedPath = path.join(tempDir, zipEntryName);
        if (!fs.existsSync(extractedPath)) throw new Error(`7z Extraction failed: ${zipEntryName} not found`);

        fs.renameSync(extractedPath, destPath);
      } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (err) { void err; }
      }
    } 
    else {
      await extractZipEntry(sourcePath, zipEntryName, destPath);
    }
  },

  extract7z: (archivePath: string, outputDir: string, fileToExtract?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const args = ['x', archivePath, `-o${outputDir}`, '-y'];
      if (fileToExtract) args.push(fileToExtract);

      console.log(`[Extractor] Spawning 7z: ${args.join(' ')}`);
      const child = spawn(pathTo7zip, args);

      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`7-Zip exited with code ${code}`));
      });
      
      child.on('error', (err) => reject(err));
    });
  },

  list7z: (filePath: string): Promise<SevenZipEntry[]> => {
    return new Promise((resolve, reject) => {
      const child = spawn(pathTo7zip, ['l', filePath, '-slt']);
      let stdout = '';

      child.stdout.on('data', (d) => stdout += d.toString());
      child.on('close', (code) => {
        if (code !== 0) return reject(new Error("Failed to list archive"));

        const entries: SevenZipEntry[] = [];
        const blocks = stdout.split(/(\r\n|\r|\n){2}/);
        
        for (const block of blocks) {
          const rawEntry: Record<string, string> = {};

          block.split(/(\r\n|\r|\n)/).forEach(line => {
            if (line.includes('=')) {
              const [k, ...v] = line.split('=');
              rawEntry[k.trim()] = v.join('=').trim();
            }
          });

          if (rawEntry.Path) {
            entries.push({ 
              file: rawEntry.Path, 
              attr: rawEntry.Attributes,
              size: rawEntry.Size,
            });
          }
        }
        resolve(entries);
      });
    });
  }
};