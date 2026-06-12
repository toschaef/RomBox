import { spawn } from 'child_process';
import sevenBin from '7zip-bin';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { extractZipEntry } from './fsUtils';
import { Logger } from './logger';

const log = Logger.create('Extractor');

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
        await fs.promises.mkdir(destDir, { recursive: true });

        const st = await fs.promises.stat(sourcePath);
        if (st.isDirectory()) {
          await fs.promises.cp(sourcePath, destPath, { recursive: true, force: true });
        } else {
          await fs.promises.copyFile(sourcePath, destPath);
        }
      }
      return;
    }

    const ext = path.extname(sourcePath).toLowerCase();
    const destDir = path.dirname(destPath);
    await fs.promises.mkdir(destDir, { recursive: true });

    if (ext === '.7z') {
      const tempDir = path.join(app.getPath('temp'), 'rombox_7z_' + crypto.randomUUID());
      await fs.promises.mkdir(tempDir, { recursive: true });

      try {
        await Extractor.extract7z(sourcePath, tempDir, zipEntryName);

        const extractedPath = path.join(tempDir, zipEntryName);
        if (!fs.existsSync(extractedPath)) throw new Error(`7z Extraction failed: ${zipEntryName} not found`);

        const st = await fs.promises.stat(extractedPath);
        if (st.isDirectory()) {
          await fs.promises.cp(extractedPath, destPath, { recursive: true, force: true });
          await fs.promises.rm(extractedPath, { recursive: true, force: true });
        } else {
          await fs.promises.rename(extractedPath, destPath);
        }
      } finally {
        try { await fs.promises.rm(tempDir, { recursive: true, force: true }); } catch (err) { void err; }
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

      const child = spawn(pathTo7zip, args);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          log.error(`7z extraction failed with code ${code}`);
          log.error(`stdout: ${stdout}`);
          log.error(`stderr: ${stderr}`);
          reject(new Error(`7-Zip exited with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (err) => {
        log.error('7z spawn error', err);
        reject(err);
      });
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
        const archiveBasename = path.basename(filePath);

        for (const block of blocks) {
          const rawEntry: Record<string, string> = {};

          block.split(/(\r\n|\r|\n)/).forEach(line => {
            if (line.includes('=')) {
              const [k, ...v] = line.split('=');
              rawEntry[k.trim()] = v.join('=').trim();
            }
          });

          if (rawEntry.Path && rawEntry.Size !== undefined && rawEntry.Size !== '') {
            const entryBasename = path.basename(rawEntry.Path);

            if (entryBasename === archiveBasename && rawEntry.Path.includes('/')) {
              continue;
            }

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
  },

  extractArchive: async (filePath: string, destDir: string): Promise<void> => {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".zip") {
      log.info(`ZIP extract: ${path.basename(filePath)} -> ${destDir}`);
      const zip = new AdmZip(filePath);
      zip.extractAllTo(destDir, true);
      return;
    }

    if ([".7z", ".tar", ".gz", ".xz", ".rar"].includes(ext)) {
      log.info(`7z extract: ${path.basename(filePath)} -> ${destDir}`);
      await Extractor.extract7z(filePath, destDir);
      return;
    }

    throw new Error(`Unsupported archive format: ${ext}`);
  }
};