import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

const EVENT = 'rombox:preference';

type PreferenceEvent = CustomEvent<{ key: string; value: string }>;

export function readPreference<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return parse(raw);
  } catch {
    return fallback;
  }
}

export function usePersistedState<T>(
  key: string,
  fallback: T,
  codec: Codec<T>
) {
  const codecRef = useRef(codec);
  codecRef.current = codec;

  const [value, setValue] = useState<T>(() => readPreference(key, fallback, codec.parse));

  useEffect(() => {
    const onLocal = (e: Event) => {
      const detail = (e as PreferenceEvent).detail;
      if (detail?.key === key) setValue(codecRef.current.parse(detail.value));
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) setValue(codecRef.current.parse(e.newValue));
    };

    window.addEventListener(EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, [key]);

  const set: Dispatch<SetStateAction<T>> = useCallback(
    (next: SetStateAction<T>) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        const raw = codecRef.current.serialize(resolved);
        localStorage.setItem(key, raw);
        window.dispatchEvent(new CustomEvent(EVENT, { detail: { key, value: raw } }));
        return resolved;
      });
    },
    [key]
  );

  return [value, set] as const;
}

export type Codec<T> = { parse: (raw: string) => T; serialize: (value: T) => string };

export const boolCodec: Codec<boolean> = { parse: (raw) => raw === 'true', serialize: (v) => String(v) };
export const intCodec: Codec<number> = { parse: (raw) => parseInt(raw, 10), serialize: (v) => String(v) };

export const enumCodec = <T extends string>(): Codec<T> => ({ parse: (raw) => raw as T, serialize: (v) => v });
