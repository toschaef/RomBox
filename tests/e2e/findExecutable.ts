import path from "node:path";
import fs from "node:fs"

export default function findExecutable(): string {
  if (!process.env.TEST_PACKAGED) {
    return '';
  }
  const outDir = path.join(__dirname, '../../out');
  if (fs.existsSync(outDir)) {
    const folders = fs.readdirSync(outDir);
    for (const folder of folders) {
      if (folder.startsWith('rombox-darwin-')) {
        const appPath = path.join(outDir, folder, 'rombox.app/Contents/MacOS/rombox');
        if (fs.existsSync(appPath)) {
          return appPath;
        }
      }
    }
  }
  return '';
}