export type GroupOption = 'none' | 'console' | 'engine';

const GROUP_OPTIONS: { value: GroupOption; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'console', label: 'Console' },
  { value: 'engine', label: 'Engine' },
];

interface GroupSelectProps {
  value: GroupOption;
  onChange: (value: GroupOption) => void;
}

export default function GroupSelect({ value, onChange }: GroupSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-fg-muted font-medium hidden sm:block">Group:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as GroupOption)}
        className="
          bg-bg-secondary text-fg-primary text-sm
          border border-border-subtle rounded-none
          px-3 py-1.5
          hover:border-border-highlight
          focus:border-accent-primary focus:outline-none
          transition-colors cursor-pointer
        "
      >
        {GROUP_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
