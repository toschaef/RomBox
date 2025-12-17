import path from 'path';
import { app } from 'electron';

export interface EngineConfig {
  id: string;
  name: string;
  executable: string;
  downloadUrl: string;
  zipName: string;
}

const BASE_PATH = path.join(app.getPath('userData'), 'engines');

const getMacUrl = () => {
  const version = '2.1.1';
  const baseUrl = `https://github.com/SourMesen/Mesen2/releases/download/${version}`;
  
  if (process.arch === 'arm64') {
    return `${baseUrl}/Mesen_${version}_macOS_ARM64_AppleSilicon.zip`;
  } else {
    return `${baseUrl}/Mesen_${version}_macOS_x64_Intel.zip`;
  }
};

export const ENGINES: Record<string, EngineConfig> = {
  nes: {
    id: 'nes',
    name: 'Mesen 2',
    
    executable: process.platform === 'win32' 
      ? 'Mesen.exe' 
      : 'Mesen.app/Contents/MacOS/Mesen',
      
    downloadUrl: process.platform === 'win32'
      ? 'https://github.com/SourMesen/Mesen2/releases/download/2.1.1/Mesen_2.1.1_Windows.zip'
      : getMacUrl(),
      
    zipName: 'Mesen'
  }
};

export const getEnginePath = (consoleId: string) => {
  const engine = ENGINES[consoleId];
  if (!engine) return null;
  return path.join(BASE_PATH, engine.id, engine.executable);
};