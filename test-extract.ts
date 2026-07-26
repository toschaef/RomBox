const mockApp = { getPath: () => '/tmp/test-rombox', getAppPath: () => __dirname, isPackaged: false };
import proxyquire from 'proxyquire';
const { EngineService } = proxyquire('./src/main/services/EngineService', { 'electron': { app: mockApp } });

import { MacHandler } from './src/main/platform/MacHandler';
import path from 'path';
import fs from 'fs';
import { findFile } from './src/main/utils/fsUtils';

async function test() {
  const handler = new MacHandler();
  
  if (!fs.existsSync('/tmp/test-rombox/engines')) {
    fs.mkdirSync('/tmp/test-rombox/engines', { recursive: true });
  }
  
  console.log("Installing PCSX2...");
  try {
    const res = await EngineService.installEngine('pcsx2', (s) => console.log(s));
    console.log("Result:", res);
  } catch (e) {
    console.log("Error:", e);
  }
  
  const found = findFile('/tmp/test-rombox/engines/pcsx2', 'PCSX2');
  console.log("Found:", found);
}

test();
