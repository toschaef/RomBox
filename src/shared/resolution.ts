import type { EngineID } from './types/engines';

export const RESOLUTION_OPTIONS = [
  { label: 'Native', value: 0 },
  { label: '720p', value: 720 },
  { label: '1080p', value: 1080 },
  { label: '1440p', value: 1440 },
  { label: '4K (2160p)', value: 2160 },
] as const;

const NATIVE_HEIGHTS: Partial<Record<EngineID, number>> = {
  duckstation: 240,
  pcsx2: 448,
  dolphin: 528,
  azahar: 240,
};

/**
 * compute internal resolution multiplier to use
 */
export function getResolutionMultiplier(targetHeight: number, engineId: EngineID): number {
  if (targetHeight === 0) return 1;

  const native = NATIVE_HEIGHTS[engineId];
  if (!native) return 1;

  return Math.max(1, Math.ceil(targetHeight / native));
}
