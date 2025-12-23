import fs from 'fs/promises';
import type { ConsoleID } from '../../shared/types';
import { SIGNATURES } from '../../shared/constants';

// buffer needs to be at least 33KB to check ps2 header
const HEADER_READ_SIZE = 0x8100; 

export const detectConsoleFromHeader = async (filePath: string): Promise<ConsoleID | undefined> => {
  let handle: fs.FileHandle | null = null;
  
  try {
    handle = await fs.open(filePath, 'r');
    
    const buffer = Buffer.alloc(HEADER_READ_SIZE);
    
    const { bytesRead } = await handle.read(buffer, 0, HEADER_READ_SIZE, 0);

    for (const sig of SIGNATURES) {
      if (bytesRead < sig.offset + sig.bytes.length) continue;

      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[sig.offset + i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) return sig.id;
    }

  } catch (error) {
    console.warn(`[Identifier] Failed to read header for ${filePath}`, error);
  } finally {
    await handle?.close();
  }

  return undefined;
};