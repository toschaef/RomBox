interface GridSizeControlProps {
  value: number;
  onChange: (updater: (prev: number) => number) => void;
}

export default function GridSizeControl({ value, onChange }: GridSizeControlProps) {
  return (
    <div className="flex items-center border border-border-subtle rounded-none overflow-hidden">
      <button
        onClick={() => onChange(s => Math.max(1, s - 1))}
        disabled={value <= 1}
        className="
          w-7 h-7 flex items-center justify-center
          bg-bg-secondary text-fg-primary text-sm font-bold
          hover:border-border-highlight hover:bg-bg-muted
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors border-r border-border-subtle
        "
      >
        +
      </button>
      <button
        onClick={() => onChange(s => Math.min(6, s + 1))}
        disabled={value >= 7}
        className="
          w-7 h-7 flex items-center justify-center
          bg-bg-secondary text-fg-primary text-sm font-bold
          hover:border-border-highlight hover:bg-bg-muted
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors
        "
      >
        -
      </button>
    </div>
  );
}
