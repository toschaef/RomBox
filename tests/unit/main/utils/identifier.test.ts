import fs from 'fs/promises';
import path from 'path';
import { detectConsoleFromHeader, parseCueSectorGeometry, PLAIN_ISO_GEOMETRY } from '../../../../src/main/utils/identifier';

describe('parseCueSectorGeometry', () => {
  it('returns raw MODE1/2352 geometry (16-byte header before the payload)', () => {
    expect(parseCueSectorGeometry('FILE "game.bin" BINARY\n  TRACK 01 MODE1/2352\n    INDEX 01 00:00:00\n'))
      .toEqual({ stride: 2352, dataOffset: 16 });
  });

  it('returns raw MODE2/2352 (XA Form 1) geometry (24-byte header before the payload)', () => {
    expect(parseCueSectorGeometry('FILE "game.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n'))
      .toEqual({ stride: 2352, dataOffset: 24 });
  });

  it('treats MODE1/2048 as already logical-sector-aligned', () => {
    expect(parseCueSectorGeometry('FILE "game.bin" BINARY\n  TRACK 01 MODE1/2048\n'))
      .toEqual(PLAIN_ISO_GEOMETRY);
  });

  it('falls back to plain geometry when no data track is found', () => {
    expect(parseCueSectorGeometry('FILE "game.bin" BINARY\n  TRACK 01 AUDIO\n')).toEqual(PLAIN_ISO_GEOMETRY);
    expect(parseCueSectorGeometry('not a cue file')).toEqual(PLAIN_ISO_GEOMETRY);
  });
});

describe('detectConsoleFromHeader utility', () => {
  const tempDir = path.resolve(__dirname, '../../../temp-identifier-tests');

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore errors during teardown
    }
  });

  it('should detect GameCube (gc) files correctly', async () => {
    const filePath = path.join(tempDir, 'gamecube.iso');
    const buffer = Buffer.alloc(0x200); // 512 bytes
    
    // GC Signature: offset 0x1C, bytes [0xC2, 0x33, 0x9F, 0x3D]
    buffer[0x1C] = 0xC2;
    buffer[0x1D] = 0x33;
    buffer[0x1E] = 0x9F;
    buffer[0x1F] = 0x3D;

    await fs.writeFile(filePath, buffer);
    const consoleId = await detectConsoleFromHeader(filePath);
    expect(consoleId).toBe('gc');
  });

  it('should detect Wii files correctly', async () => {
    const filePath = path.join(tempDir, 'wii.iso');
    const buffer = Buffer.alloc(0x200);

    // Wii Signature: offset 0x18, bytes [0x5D, 0x1C, 0x9E, 0xA3]
    buffer[0x18] = 0x5D;
    buffer[0x19] = 0x1C;
    buffer[0x1A] = 0x9E;
    buffer[0x1B] = 0xA3;

    await fs.writeFile(filePath, buffer);
    const consoleId = await detectConsoleFromHeader(filePath);
    expect(consoleId).toBe('wii');
  });

  // Builds a minimal ISO9660 image whose root directory contains a
  // SYSTEM.CNF file with the given content, at fixed sectors (PVD @ 16,
  // root dir @ 20, SYSTEM.CNF data @ 21) - matching what
  // detectPS1orPS2FromISO9660 walks.
  const buildIso9660WithSystemCnf = (systemCnfContent: string): Buffer => {
    const SECTOR = 2048;
    const buffer = Buffer.alloc(24 * SECTOR);

    const pvdOffset = 16 * SECTOR;
    buffer.write('CD001', pvdOffset + 1, 'ascii');
    buffer[pvdOffset] = 1;

    const rootRecordOffset = pvdOffset + 156;
    const rootDirLba = 20;
    buffer[rootRecordOffset] = 34;
    buffer.writeUInt32LE(rootDirLba, rootRecordOffset + 2);
    buffer.writeUInt32LE(SECTOR, rootRecordOffset + 10);

    const rootDirSectorOffset = rootDirLba * SECTOR;
    const sysCnfLba = 21;
    const fileId = 'SYSTEM.CNF';
    buffer[rootDirSectorOffset] = 44;
    buffer.writeUInt32LE(sysCnfLba, rootDirSectorOffset + 2);
    buffer.writeUInt32LE(Buffer.byteLength(systemCnfContent), rootDirSectorOffset + 10);
    buffer[rootDirSectorOffset + 32] = fileId.length;
    buffer.write(fileId, rootDirSectorOffset + 33, 'ascii');

    buffer.write(systemCnfContent, sysCnfLba * SECTOR, 'ascii');

    return buffer;
  };

  it('should detect PS2 files via the SYSTEM.CNF BOOT2 marker (not just the shared PLAYSTATION id string)', async () => {
    const filePath = path.join(tempDir, 'ps2.iso');
    const buffer = buildIso9660WithSystemCnf('BOOT2 = cdrom0:\\SLUS_200.01;1\r\n');

    await fs.writeFile(filePath, buffer);
    const consoleId = await detectConsoleFromHeader(filePath);
    expect(consoleId).toBe('ps2');
  });

  it('should detect PS1 files via the SYSTEM.CNF BOOT marker, distinguishing them from PS2', async () => {
    const filePath = path.join(tempDir, 'ps1.iso');
    const buffer = buildIso9660WithSystemCnf('BOOT = cdrom:\\SLUS_005.01;1\r\n');

    await fs.writeFile(filePath, buffer);
    const consoleId = await detectConsoleFromHeader(filePath);
    expect(consoleId).toBe('ps1');
  });

  it('should detect Wii files inside an RVZ container via the embedded disc header, not file size', async () => {
    const filePath = path.join(tempDir, 'small.rvz');
    const buffer = Buffer.alloc(0x200);

    buffer.write('RVZ\x01', 0, 'ascii');
    // disc_header lives at file offset 0x58; Wii signature is at 0x18 within it.
    buffer[0x58 + 0x18] = 0x5D;
    buffer[0x58 + 0x19] = 0x1C;
    buffer[0x58 + 0x1A] = 0x9E;
    buffer[0x58 + 0x1B] = 0xA3;

    await fs.writeFile(filePath, buffer);
    const consoleId = await detectConsoleFromHeader(filePath);
    expect(consoleId).toBe('wii');
  });

  it('should detect GameCube files inside an RVZ/WIA container via the embedded disc header', async () => {
    const filePath = path.join(tempDir, 'game.rvz');
    const buffer = Buffer.alloc(0x200);

    buffer.write('WIA\x01', 0, 'ascii');
    // disc_header lives at file offset 0x58; GC signature is at 0x1C within it.
    buffer[0x58 + 0x1C] = 0xC2;
    buffer[0x58 + 0x1D] = 0x33;
    buffer[0x58 + 0x1E] = 0x9F;
    buffer[0x58 + 0x1F] = 0x3D;

    await fs.writeFile(filePath, buffer);
    const consoleId = await detectConsoleFromHeader(filePath);
    expect(consoleId).toBe('gc');
  });

  it('should return undefined if no matching signature is found', async () => {
    const filePath = path.join(tempDir, 'unknown.bin');
    const buffer = Buffer.alloc(0x1000);
    
    // Fill with generic bytes
    buffer.fill(0xAA);

    await fs.writeFile(filePath, buffer);
    const consoleId = await detectConsoleFromHeader(filePath);
    expect(consoleId).toBeUndefined();
  });

  it('should return undefined and catch gracefully when file does not exist', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { /* mock */ });
    const consoleId = await detectConsoleFromHeader(path.join(tempDir, 'does-not-exist.bin'));
    
    expect(consoleId).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
