export type SortOption = 'recent' | 'title-asc' | 'title-desc' | 'playtime-desc' | 'playtime-asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recently Played' },
  { value: 'title-asc', label: 'A-Z' },
  { value: 'title-desc', label: 'Z-A' },
  { value: 'playtime-desc', label: 'Most Playtime' },
  { value: 'playtime-asc', label: 'Least Playtime' },
];

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export default function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-fg-muted font-medium hidden sm:block">Sort:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="
          bg-bg-secondary text-fg-primary text-sm
          border border-border-subtle rounded-none
          px-3 py-1.5
          hover:border-border-highlight
          focus:border-accent-primary focus:outline-none
          transition-colors cursor-pointer
        "
      >
        {SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
