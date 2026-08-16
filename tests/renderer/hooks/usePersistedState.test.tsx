import { renderHook, act } from '@testing-library/react';
import { usePersistedState, boolCodec, intCodec, enumCodec } from '../../../src/renderer/hooks/usePersistedState';

describe('usePersistedState', () => {
  beforeEach(() => localStorage.clear());

  it('falls back when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedState('k', true, boolCodec));
    expect(result.current[0]).toBe(true);
  });

  it('reads an existing value', () => {
    localStorage.setItem('k', 'false');
    const { result } = renderHook(() => usePersistedState('k', true, boolCodec));
    expect(result.current[0]).toBe(false);
  });

  it('persists writes', () => {
    const { result } = renderHook(() => usePersistedState('k', 3, intCodec));
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(localStorage.getItem('k')).toBe('5');
  });

  it('supports updater functions', () => {
    const { result } = renderHook(() => usePersistedState('k', 3, intCodec));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(4);
  });

  // the bug this hook exists to fix: two components on the same key
  it('propagates a write to every other consumer of the key', () => {
    const writer = renderHook(() => usePersistedState('align', false, boolCodec));
    const reader = renderHook(() => usePersistedState('align', false, boolCodec));

    act(() => writer.result.current[1](true));

    expect(reader.result.current[0]).toBe(true);
  });

  it('ignores writes to unrelated keys', () => {
    const a = renderHook(() => usePersistedState('a', false, boolCodec));
    const b = renderHook(() => usePersistedState('b', false, boolCodec));

    act(() => a.result.current[1](true));

    expect(b.result.current[0]).toBe(false);
  });

  it('round-trips string unions', () => {
    const { result } = renderHook(() => usePersistedState<'x' | 'y'>('u', 'x', enumCodec<'x' | 'y'>()));
    act(() => result.current[1]('y'));
    expect(result.current[0]).toBe('y');
    expect(localStorage.getItem('u')).toBe('y');
  });
});
