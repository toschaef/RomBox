// gridSize is a column-count knob; the card only cares how much room it has.
// this replaces the two getButtonStyle() ladders that branched on raw numbers.
export type GameCardDensity = 'compact' | 'dense' | 'comfortable';

export function densityFor(gridSize: number): GameCardDensity {
  if (gridSize >= 6) return 'compact';
  if (gridSize >= 4) return 'dense';
  return 'comfortable';
}

export function menuButtonSize(density: GameCardDensity): 'xs' | 'sm' | 'md' {
  if (density === 'compact') return 'xs';
  if (density === 'dense') return 'sm';
  return 'md';
}
