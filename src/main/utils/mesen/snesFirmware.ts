import fs from "fs";
import { inspectSnesRom } from "./snesInspector";


function hasEmbeddedFirmware(romPath: string): boolean {
  const size = fs.statSync(romPath).size;
  if ((size & 0x7fff) === 0x2000) return true;
  if ((size & 0xffff) === 0xd000) return true;
  return false;
}

function firmwareForCartName(cartName: string): string {
  if (cartName === "DUNGEON MASTER") return "dsp2.rom";
  if (cartName === "PILOTWINGS") return "dsp1.rom";
  if (cartName === "PLANETS CHAMP TG3000" || cartName === "TOP GEAR 3000") return "dsp4.rom";
  return "dsp1b.rom";
}

export function getRequiredSnesFirmware(romPath: string): string[] {
  const info = inspectSnesRom(romPath);
  console.log("[snes-fw] info", info);
  if (!info) return [];

  const romType = info.romType;
  const low = romType & 0x0f;
  const high = (romType & 0xf0) >> 4;

  const isDspBucket = low >= 0x03 && high === 0x00;
  console.log("[snes-fw] romType", romType, "low", low, "high", high, "isDspBucket", isDspBucket);

  if (!isDspBucket) return [];

  const embedded = hasEmbeddedFirmware(romPath);
  console.log("[snes-fw] embedded?", embedded);
  if (embedded) return [];

  const fw = firmwareForCartName(info.cartName);
  console.log("[snes-fw] need", fw);
  return [fw];
}