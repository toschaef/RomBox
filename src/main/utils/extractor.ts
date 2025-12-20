import { spawn } from 'child_process';
import sevenBin from '7zip-bin';
import fs from 'fs';

const pathTo7zip = sevenBin.path7za;

// fix permissions on load
if (process.platform !== 'win32') {
  try {
    if (fs.existsSync(pathTo7zip)) fs.chmodSync(pathTo7zip, '755');
  } catch (e) {}
}

export const Extractor = {
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

  list7z: (filePath: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const child = spawn(pathTo7zip, ['l', filePath, '-slt']);
      let stdout = '';

      child.stdout.on('data', (d) => stdout += d.toString());
      child.on('close', (code) => {
        if (code !== 0) return reject(new Error("Failed to list archive"));

        const entries: any[] = [];
        const blocks = stdout.split(/(\r\n|\r|\n){2}/);
        
        for (const block of blocks) {
            const entry: any = {};
            block.split(/(\r\n|\r|\n)/).forEach(line => {
                if (line.includes('=')) {
                    const [k, ...v] = line.split('=');
                    entry[k.trim()] = v.join('=').trim();
                }
            });
            if (entry.Path) entries.push({ file: entry.Path, attr: entry.Attributes });
        }
        resolve(entries);
      });
    });
  }
};