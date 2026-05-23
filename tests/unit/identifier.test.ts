import fs from 'fs/promises';
import path from 'path';
import { detectConsoleFromHeader } from '../../src/main/utils/identifier';

describe('detectConsoleFromHeader utility', () => {
  const tempDir = path.resolve(__dirname, '../temp-identifier-tests');

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

  it('should detect PS2 files correctly', async () => {
    const filePath = path.join(tempDir, 'ps2.iso');
    // Buffer size needs to be larger than PS2 offset 0x8008 + 11 signature bytes
    // Buffer read size in identifier is 0x8100 (33024 bytes)
    const buffer = Buffer.alloc(0x8100);

    // PS2 Signature: offset 0x8008, bytes for "PLAYSTATION"
    const sig = [0x50, 0x4C, 0x41, 0x59, 0x53, 0x54, 0x41, 0x54, 0x49, 0x4F, 0x4E];
    for (let i = 0; i < sig.length; i++) {
      buffer[0x8008 + i] = sig[i];
    }

    await fs.writeFile(filePath, buffer);
    const consoleId = await detectConsoleFromHeader(filePath);
    expect(consoleId).toBe('ps2');
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
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleId = await detectConsoleFromHeader(path.join(tempDir, 'does-not-exist.bin'));
    
    expect(consoleId).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
