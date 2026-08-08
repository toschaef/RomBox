import fs from 'fs/promises';
import type { ConsoleID } from '../../shared/types';
import { SIGNATURES } from '../../shared/emulators/derived';

const HEADER_READ_SIZE = 0x8100;
const SECTOR_SIZE = 2048;

const WIA_RVZ_MAGICS = [0x57494101, 0x52565a01]; // "WIA\x01", "RVZ\x01"
const WIA_DISC_HEADER_OFFSET = 0x58;
const WIA_DISC_HEADER_SIZE = 0x80;

const getDiscHeaderBuffer = (buffer: Buffer): Buffer => {
  if (buffer.length >= 4) {
    const magic = buffer.readUInt32BE(0);
    if (WIA_RVZ_MAGICS.includes(magic) && buffer.length >= WIA_DISC_HEADER_OFFSET + WIA_DISC_HEADER_SIZE) {
      return buffer.subarray(WIA_DISC_HEADER_OFFSET, WIA_DISC_HEADER_OFFSET + WIA_DISC_HEADER_SIZE);
    }
  }
  return buffer;
};

export const detectConsoleFromBuffer = (buffer: Buffer): ConsoleID | undefined => {
  if (buffer.length >= 4 && buffer[0] === 0x4e && buffer[1] === 0x45 && buffer[2] === 0x53 && buffer[3] === 0x1a) {
    return 'nes';
  }

  if (buffer.length >= 4) {
    const magic = buffer.readUInt32BE(0);
    if ([0x80371240, 0x37804012, 0x40123780].includes(magic)) {
      return 'n64';
    }
  }

  const discHeader = getDiscHeaderBuffer(buffer);
  for (const sig of SIGNATURES) {
    if (discHeader.length < sig.offset + sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (discHeader[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.id;
  }

  return undefined;
};

const readAt = async (handle: fs.FileHandle, position: number, length: number): Promise<Buffer> => {
  const buffer = Buffer.alloc(length);
  await handle.read(buffer, 0, length, position);
  return buffer;
};

export interface SectorGeometry {
  stride: number;
  dataOffset: number;
}

export const PLAIN_ISO_GEOMETRY: SectorGeometry = { stride: SECTOR_SIZE, dataOffset: 0 };

export const parseCueSectorGeometry = (cueText: string): SectorGeometry => {
  const match = cueText.match(/TRACK\s+\d+\s+MODE(\d)\/(\d+)/i);
  if (!match) return PLAIN_ISO_GEOMETRY;

  const mode = match[1];
  const bytes = parseInt(match[2], 10);

  if (bytes === 2352) return { stride: 2352, dataOffset: mode === '1' ? 16 : 24 };
  if (bytes === 2336) return { stride: 2336, dataOffset: 8 };
  return PLAIN_ISO_GEOMETRY;
};

export const parseCueSectorGeometryFromFile = async (cuePath: string): Promise<SectorGeometry> => {
  try {
    return parseCueSectorGeometry(await fs.readFile(cuePath, 'utf-8'));
  } catch (error) {
    console.warn(`[Identifier] Failed to read cue file ${cuePath}`, error);
    return PLAIN_ISO_GEOMETRY;
  }
};

type ByteRangeReader = (position: number, length: number) => Promise<Buffer>;

const readLogicalSectors = async (
  read: ByteRangeReader,
  geometry: SectorGeometry,
  startLba: number,
  sectorCount: number
): Promise<Buffer> => {
  const out = Buffer.alloc(sectorCount * SECTOR_SIZE);
  for (let i = 0; i < sectorCount; i++) {
    const physicalOffset = (startLba + i) * geometry.stride + geometry.dataOffset;
    const chunk = await read(physicalOffset, SECTOR_SIZE);
    chunk.copy(out, i * SECTOR_SIZE);
  }
  return out;
};

const scanIso9660ForBootMarker = async (
  read: ByteRangeReader,
  geometry: SectorGeometry
): Promise<'ps1' | 'ps2' | undefined> => {
  try {
    const pvd = await readLogicalSectors(read, geometry, 16, 1);
    if (pvd.toString('ascii', 1, 6) !== 'CD001') return undefined;

    const rootRecordOffset = 156;
    const rootExtentLba = pvd.readUInt32LE(rootRecordOffset + 2);
    const rootDataLength = pvd.readUInt32LE(rootRecordOffset + 10);
    if (!rootExtentLba || !rootDataLength || rootDataLength > 1024 * 1024) return undefined;

    const rootDirSectors = Math.ceil(rootDataLength / SECTOR_SIZE);
    const rootDir = await readLogicalSectors(read, geometry, rootExtentLba, rootDirSectors);

    let systemCnf: { lba: number; size: number } | undefined;
    let offset = 0;
    while (offset < rootDir.length - 33) {
      const recLen = rootDir[offset];
      if (recLen === 0) {
        offset = (Math.floor(offset / SECTOR_SIZE) + 1) * SECTOR_SIZE;
        continue;
      }

      const fileIdLen = rootDir[offset + 32];
      const fileId = rootDir.toString('ascii', offset + 33, offset + 33 + fileIdLen);
      if (fileId.toUpperCase().replace(/;\d+$/, '') === 'SYSTEM.CNF') {
        systemCnf = {
          lba: rootDir.readUInt32LE(offset + 2),
          size: rootDir.readUInt32LE(offset + 10),
        };
        break;
      }

      offset += recLen;
    }

    if (!systemCnf || !systemCnf.size || systemCnf.size > SECTOR_SIZE * 4) return undefined;

    const contentSectors = Math.ceil(systemCnf.size / SECTOR_SIZE);
    const content = await readLogicalSectors(read, geometry, systemCnf.lba, contentSectors);
    const text = content.toString('ascii', 0, systemCnf.size);

    if (/\bBOOT2\s*=/i.test(text)) return 'ps2';
    if (/\bBOOT\s*=/i.test(text)) return 'ps1';
    return undefined;
  } catch (error) {
    console.warn('[Identifier] Failed to inspect ISO9660 structure', error);
    return undefined;
  }
};

export const detectPS1orPS2FromISO9660 = async (
  filePath: string,
  geometry: SectorGeometry = PLAIN_ISO_GEOMETRY
): Promise<'ps1' | 'ps2' | undefined> => {
  let handle: fs.FileHandle | null = null;

  try {
    handle = await fs.open(filePath, 'r');
    const openHandle = handle;
    return await scanIso9660ForBootMarker((position, length) => readAt(openHandle, position, length), geometry);
  } catch (error) {
    console.warn(`[Identifier] Failed to inspect ISO9660 structure for ${filePath}`, error);
    return undefined;
  } finally {
    await handle?.close();
  }
};

export const detectPS1orPS2FromBuffer = (
  buffer: Buffer,
  geometry: SectorGeometry = PLAIN_ISO_GEOMETRY
): Promise<'ps1' | 'ps2' | undefined> => {
  const read: ByteRangeReader = (position, length) => {
    const out = Buffer.alloc(length);
    if (position < buffer.length) buffer.copy(out, 0, position, Math.min(position + length, buffer.length));
    return Promise.resolve(out);
  };
  return scanIso9660ForBootMarker(read, geometry);
};

export const detectConsoleFromHeader = async (filePath: string): Promise<ConsoleID | undefined> => {
  let headerBuffer: Buffer | undefined;

  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(HEADER_READ_SIZE);
      const { bytesRead } = await handle.read(buffer, 0, HEADER_READ_SIZE, 0);
      headerBuffer = buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  } catch (error) {
    console.warn(`[Identifier] Failed to read header for ${filePath}`, error);
    return undefined;
  }

  const headerMatch = detectConsoleFromBuffer(headerBuffer);
  if (headerMatch) return headerMatch;

  return detectPS1orPS2FromISO9660(filePath);
};
