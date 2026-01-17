import fs from "fs";

export type SnesCartInfo = {
  headerOffset: number;
  mapMode: number;
  romType: number;
  cartName: string;
  mapper: "lorom" | "hirom" | "exhirom" | "unknown";
};

function scoreHeader(buf: Buffer, off: number): number {
  if (buf.length < off + 0x20) return -999;

  const resetVector = buf.readUInt16LE(off + 0x3c);
  const checksum = buf.readUInt16LE(off + 0x1e);
  const checksumComp = buf.readUInt16LE(off + 0x1c);
  let score = 0;

  if (((checksum ^ checksumComp) & 0xffff) === 0xffff) score += 2;

  if (resetVector >= 0x8000) score += 2;
  else score -= 1;

  const title = buf.slice(off, off + 21);
  const printable = [...title].filter((c) => c >= 0x20 && c <= 0x7e).length;
  if (printable >= 15) score += 1;

  return score;
}

function guessHeaderOffset(buf: Buffer): number {
  const cands = [0x7fc0, 0xffc0, 0x40ffc0].filter((x) => x < buf.length);
  let best = cands[0] ?? 0x7fc0;
  let bestScore = -999;

  for (const off of cands) {
    const s = scoreHeader(buf, off);
    if (s > bestScore) {
      bestScore = s;
      best = off;
    }
  }
  return best;
}

function mapperFromHeaderOffset(off: number): SnesCartInfo["mapper"] {
  if (off === 0x7fc0) return "lorom";
  if (off === 0xffc0) return "hirom";
  if (off === 0x40ffc0) return "exhirom";
  return "unknown";
}

export function inspectSnesRom(filePath: string): SnesCartInfo | null {
  const fd = fs.openSync(filePath, "r");
  try {
    const max = Math.min(fs.statSync(filePath).size, 0x410000);
    const buf = Buffer.alloc(max);
    fs.readSync(fd, buf, 0, max, 0);

    const headerOffset = guessHeaderOffset(buf);
    if (headerOffset + 0x20 > buf.length) return null;

    const romType = buf[headerOffset + 0x16];
    const mapMode = buf[headerOffset + 0x15];

    const cartNameRaw = buf.slice(headerOffset, headerOffset + 21);
    const cartName = cartNameRaw.toString("latin1").replace(/\s+$/g, "");

    return {
      headerOffset,
      mapMode,
      romType,
      cartName,
      mapper: mapperFromHeaderOffset(headerOffset),
    };
  } catch {
    return null;
  } finally {
    try {
      fs.closeSync(fd);
    } catch (err) {
      void err;
    }
  }
}