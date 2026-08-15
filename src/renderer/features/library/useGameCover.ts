import { useEffect, useRef, useState } from 'react';
import type { Game } from '../../../shared/types';
import { gameClient } from '../../clients/gameClient';

// todo: change this to load before cards are rendered
export function useGameCover(game: Game) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverError, setCoverError] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          if (!timer) {
            timer = setTimeout(() => {
              setShouldLoad(true);
              observer.disconnect();
              timer = null;
            }, 200);
          }
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { rootMargin: '100px' }
    );

    if (cardRef.current) observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;

    const fetchCover = async () => {
      try {
        const existing = await gameClient.getCover(game);
        if (existing.success && existing.coverPath) {
          if (!cancelled) setCoverPath(existing.coverPath);
          return;
        }

        const fetched = await gameClient.fetchCover(game);
        if (!cancelled && fetched.success && fetched.coverPath) {
          setCoverPath(fetched.coverPath);
        }
      } catch (err) {
        console.error('Failed to fetch cover:', err);
      }
    };

    void fetchCover();

    return () => {
      cancelled = true;
    };
  }, [game.id, game.title, shouldLoad]);

  return {
    cardRef,
    coverPath,
    hasCover: !!coverPath && !coverError,
    onCoverError: () => setCoverError(true),
  };
}
