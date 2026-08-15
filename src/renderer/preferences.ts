// every localStorage key the renderer owns
export const PREFERENCE_KEYS = {
  sortBy: 'rombox:library:sortBy',
  groupBy: 'rombox:library:groupBy',
  gridSize: 'rombox:library:gridSize',
  alignGames: 'rombox:library:alignGames',
} as const;

export const PREFERENCE_DEFAULTS = {
  sortBy: 'recent',
  groupBy: 'none',
  gridSize: 3,
  alignGames: false,
} as const;
