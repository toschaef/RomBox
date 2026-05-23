import { getResolutionMultiplier } from '../../src/shared/resolution';

describe('resolution utility', () => {
  it('should return 1 if targetHeight is 0 (Native)', () => {
    expect(getResolutionMultiplier(0, 'pcsx2')).toBe(1);
    expect(getResolutionMultiplier(0, 'dolphin')).toBe(1);
  });

  it('should return 1 for engines with no native height config', () => {
    // RMG is not in NATIVE_HEIGHTS
    expect(getResolutionMultiplier(1080, 'rmg')).toBe(1);
  });

  it('should compute the correct multiplier for supported engines', () => {
    // PCSX2 native height is 448
    // 720 / 448 = 1.607 -> Ceil is 2
    expect(getResolutionMultiplier(720, 'pcsx2')).toBe(2);
    // 1080 / 448 = 2.41 -> Ceil is 3
    expect(getResolutionMultiplier(1080, 'pcsx2')).toBe(3);
    // 1440 / 448 = 3.21 -> Ceil is 4
    expect(getResolutionMultiplier(1440, 'pcsx2')).toBe(4);

    // Dolphin native height is 528
    // 1080 / 528 = 2.04 -> Ceil is 3
    expect(getResolutionMultiplier(1080, 'dolphin')).toBe(3);
  });

  it('should return at least 1 even if targetHeight is less than native height', () => {
    expect(getResolutionMultiplier(100, 'pcsx2')).toBe(1);
  });
});
