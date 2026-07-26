const { spawn } = require('child_process');
const sevenBin = require('7zip-bin');
const path = require('path');
const fs = require('fs');

const pathTo7zip = sevenBin.path7za;

function extract7z(archivePath, outputDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(pathTo7zip, ['x', archivePath, `-o${outputDir}`, '-y']);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('failed'));
    });
  });
}

async function test() {
  const destDir = '/tmp/pcsx2_dest';
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  
  await extract7z('/tmp/pcsx2-v2.6.2-macos-Qt.tar.xz', destDir);
  await extract7z(path.join(destDir, 'pcsx2-v2.6.2-macos-Qt.tar'), destDir);
  
  console.log("Strict path exists?", fs.existsSync(path.join(destDir, "PCSX2-v2.6.2.app/Contents/MacOS/PCSX2")));
}

test().catch(console.error);
