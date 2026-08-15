import { statusFor, computeInstalledList, menuFilesFor, sortBios } from '../../../../src/renderer/features/bios/biosModel';
import type { BiosStatus } from '../../../../src/shared/types/bios';

const bios = (over: Partial<BiosStatus>): BiosStatus =>
  ({
    consoleId: 'ps1',
    engineId: 'duckstation',
    needsBios: true,
    required: true,
    onlyNeedOne: false,
    biosState: 'ok',
    cachedFiles: [],
    missingRequiredFiles: [],
    missingWarningFiles: [],
    ...over,
  }) as BiosStatus;

describe('statusFor', () => {
  it('reports no bios needed regardless of engine state', () => {
    expect(statusFor(bios({ needsBios: false }), false)).toEqual({ label: 'No BIOS needed', tone: 'neutral' });
  });

  it('distinguishes cached from unconfigured when the engine is absent', () => {
    expect(statusFor(bios({ cachedFiles: ['a.bin'] }), false).label).toBe('Saved in cache');
    expect(statusFor(bios({ cachedFiles: [] }), false)).toEqual({ label: 'Not set up yet', tone: 'warn' });
  });

  it.each([
    ['ok', 'BIOS OK', 'ok'],
    ['warning', 'BIOS optional', 'warn'],
    ['missing', 'BIOS missing', 'bad'],
  ] as const)('maps %s state once the engine is installed', (state, label, tone) => {
    expect(statusFor(bios({ biosState: state }), true)).toEqual({ label, tone });
  });
});

describe('computeInstalledList', () => {
  it('derives 3ds folders from what is NOT missing', () => {
    const b = bios({ consoleId: '3ds', missingWarningFiles: ['sdmc'] });
    expect(computeInstalledList(b)).toEqual(['nand', 'sysdata']);
  });

  it('is case insensitive about the missing 3ds folder names', () => {
    const b = bios({ consoleId: '3ds', missingWarningFiles: ['SDMC', 'NAND'] });
    expect(computeInstalledList(b)).toEqual(['sysdata']);
  });

  it('uses cached files for every other console', () => {
    expect(computeInstalledList(bios({ cachedFiles: ['scph5501.bin'] }))).toEqual(['scph5501.bin']);
  });

  it('copies rather than aliasing cachedFiles', () => {
    const b = bios({ cachedFiles: ['a.bin'] });
    computeInstalledList(b).push('b.bin');
    expect(b.cachedFiles).toEqual(['a.bin']);
  });
});

describe('menuFilesFor', () => {
  it('prefers cached files', () => {
    expect(menuFilesFor(bios({ cachedFiles: ['a.bin'], missingRequiredFiles: ['b.bin'] }))).toEqual(['a.bin']);
  });

  it('falls back to required, then warning files', () => {
    expect(menuFilesFor(bios({ missingRequiredFiles: ['req.bin'] }))).toEqual(['req.bin']);
    expect(menuFilesFor(bios({ missingWarningFiles: ['warn.bin'] }))).toEqual(['warn.bin']);
  });
});

describe('sortBios', () => {
  it('ranks missing first and no-bios-needed last', () => {
    const sorted = sortBios([
      bios({ consoleId: 'nes', needsBios: false }),
      bios({ consoleId: 'ps1', biosState: 'ok' }),
      bios({ consoleId: 'ds', biosState: 'missing' }),
      bios({ consoleId: 'gba', biosState: 'warning' }),
    ]);
    expect(sorted.map((b) => b.consoleId)).toEqual(['ds', 'gba', 'ps1', 'nes']);
  });

  it('breaks ties by console id', () => {
    const sorted = sortBios([bios({ consoleId: 'ps2' }), bios({ consoleId: 'gba' })]);
    expect(sorted.map((b) => b.consoleId)).toEqual(['gba', 'ps2']);
  });

  it('handles null', () => {
    expect(sortBios(null)).toEqual([]);
  });
});
