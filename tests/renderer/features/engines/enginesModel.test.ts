import { toRows, statusLabel, statusTone, PREFERRED_ORDER } from '../../../../src/renderer/features/engines/enginesModel';
import type { EngineInfo } from '../../../../src/shared/types/engines';

const engine = (over: Partial<EngineInfo>): EngineInfo =>
  ({
    engineId: 'ares',
    name: 'Ares',
    platform: 'darwin',
    consoles: [],
    status: 'installed',
    needsBios: false,
    biosState: 'none',
    biosMissingRequired: [],
    biosMissingWarning: [],
    ...over,
  }) as EngineInfo;

describe('statusLabel / statusTone', () => {
  it.each([
    ['installed', 'Installed', 'ok'],
    ['not_installed', 'Not installed', 'info'],
    ['broken', 'Broken', 'warn'],
    ['unsupported', 'Unsupported', 'neutral'],
  ] as const)('%s maps to %s / %s', (status, label, tone) => {
    expect(statusLabel(status)).toBe(label);
    expect(statusTone(status)).toBe(tone);
  });
});

describe('toRows', () => {
  it('returns an empty list for null', () => {
    expect(toRows(null)).toEqual([]);
  });

  it('drops unsupported engines', () => {
    const rows = toRows([engine({ engineId: 'ares', status: 'unsupported' })]);
    expect(rows).toHaveLength(0);
  });

  it('orders by the preferred list, then alphabetically', () => {
    const rows = toRows([
      engine({ engineId: 'mesen' }),
      engine({ engineId: 'dolphin' }),
      engine({ engineId: 'azahar' }),
    ]);
    expect(rows.map((r) => r.engineId)).toEqual(['dolphin', 'azahar', 'mesen']);
  });

  it('puts engines outside the preferred list last, sorted by id', () => {
    const rows = toRows([
      engine({ engineId: 'pcsx2' }),
      engine({ engineId: 'dolphin' }),
      engine({ engineId: 'duckstation' }),
    ]);
    expect(rows.map((r) => r.engineId)).toEqual(['dolphin', 'duckstation', 'pcsx2']);
    expect(PREFERRED_ORDER).not.toContain('pcsx2');
  });

  it('falls back to the engine id when no display name is set', () => {
    const rows = toRows([engine({ engineId: 'ares', name: undefined })]);
    expect(rows[0].displayName).toBe('ares');
  });

  it('flattens bios entries to consoleId:filename', () => {
    const rows = toRows([
      engine({
        engineId: 'ares',
        needsBios: true,
        biosState: 'missing',
        biosMissingRequired: [{ consoleId: 'ps1', filename: 'scph5501.bin' }],
        biosMissingWarning: [{ consoleId: 'ps1', filename: 'optional.bin' }],
      } as Partial<EngineInfo>),
    ]);
    expect(rows[0].biosMissingRequired).toEqual(['ps1:scph5501.bin']);
    expect(rows[0].biosMissingWarning).toEqual(['ps1:optional.bin']);
  });

  it('does not mutate the input array order', () => {
    const input = [engine({ engineId: 'mesen' }), engine({ engineId: 'dolphin' })];
    toRows(input);
    expect(input.map((e) => e.engineId)).toEqual(['mesen', 'dolphin']);
  });
});
