import { Segment } from '../../ui';

export const GRID_SIZE_MIN = 1;
export const GRID_SIZE_MAX = 6;

interface GridSizeControlProps {
  value: number;
  onChange: (updater: (prev: number) => number) => void;
}

export default function GridSizeControl({ value, onChange }: GridSizeControlProps) {
  return (
    <div className="flex items-center border border-border-subtle overflow-hidden">
      <Segment
        divided
        onClick={() => onChange((s) => Math.max(GRID_SIZE_MIN, s - 1))}
        disabled={value <= GRID_SIZE_MIN}
        aria-label="Larger cards"
        title="Larger cards"
        className="w-7 h-7 flex items-center justify-center text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </Segment>
      <Segment
        onClick={() => onChange((s) => Math.min(GRID_SIZE_MAX, s + 1))}
        disabled={value >= GRID_SIZE_MAX}
        aria-label="Smaller cards"
        title="Smaller cards"
        className="w-7 h-7 flex items-center justify-center text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        -
      </Segment>
    </div>
  );
}
