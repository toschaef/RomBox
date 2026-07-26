const AdmZip = require('adm-zip');
const fs = require('fs');

try {
  const destDir = '/tmp/duckstation_dest';
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  const zip = new AdmZip('/tmp/duckstation-mac-release.zip');
  zip.extractAllTo(destDir, true);
  
  if (fs.existsSync(destDir + '/DuckStation.app/Contents/MacOS/DuckStation')) {
    console.log("Found binary!");
  } else {
    console.log("Binary NOT found!");
    console.log(fs.readdirSync(destDir));
  }
} catch (err) {
  console.error("AdmZip failed:", err);
}
