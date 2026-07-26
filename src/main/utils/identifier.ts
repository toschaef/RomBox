import fs from 'fs/promises';
import type { ConsoleID } from '../../shared/types';
import { SIGNATURES } from '../../shared/constants';

// buffer needs to be at least 33KB to check ps2 header
const HEADER_READ_SIZE = 0x8100; 

export const detectConsoleFromBuffer = (buffer: Buffer, fileSize?: number): ConsoleID | undefined => {
  if (buffer.length >= 4 && buffer[0] === 0x4e && buffer[1] === 0x45 && buffer[2] === 0x53 && buffer[3] === 0x1a) {
    return 'nes';
  }

  if (buffer.length >= 4) {
    const magic = buffer.readUInt32BE(0);
    if ([0x80371240, 0x37804012, 0x40123780].includes(magic)) {
      return 'n64';
    }
  }

  for (const sig of SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.id;
  }

  return undefined;
};

export const detectConsoleFromHeader = async (filePath: string): Promise<ConsoleID | undefined> => {
  let handle: fs.FileHandle | null = null;
  
  try {
    handle = await fs.open(filePath, 'r');
    const stat = await handle.stat();
    
    const buffer = Buffer.alloc(HEADER_READ_SIZE);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_READ_SIZE, 0);

    return detectConsoleFromBuffer(buffer.subarray(0, bytesRead), stat.size);
  } catch (error) {
    console.warn(`[Identifier] Failed to read header for ${filePath}`, error);
  } finally {
    await handle?.close();
  }

  return undefined;
};