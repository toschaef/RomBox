import { Select } from '../../ui';

export type SortOption = 'recent' | 'title-asc' | 'title-desc' | 'playtime-desc' | 'playtime-asc';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently Played' },
  { value: 'title-asc', label: 'A-Z' },
  { value: 'title-desc', label: 'Z-A' },
  { value: 'playtime-desc', label: 'Most Playtime' },
  { value: 'playtime-asc', label: 'Least Playtime' },
] as const;

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export default function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="library-sort" className="text-sm text-fg-muted font-medium hidden sm:block">
        Sort:
      </label>
      <Select
        id="library-sort"
        data-testid="sort-select"
        value={value}
        options={SORT_OPTIONS}
        onChange={(v) => onChange(v as SortOption)}
      />
    </div>
  );
}
