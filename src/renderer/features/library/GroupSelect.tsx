import { Select } from '../../ui';

export type GroupOption = 'none' | 'console' | 'engine';

const GROUP_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'console', label: 'Console' },
  { value: 'engine', label: 'Engine' },
] as const;

interface GroupSelectProps {
  value: GroupOption;
  onChange: (value: GroupOption) => void;
}

export default function GroupSelect({ value, onChange }: GroupSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="library-group" className="text-sm text-fg-muted font-medium hidden sm:block">
        Group:
      </label>
      <Select
        id="library-group"
        data-testid="group-select"
        value={value}
        options={GROUP_OPTIONS}
        onChange={(v) => onChange(v as GroupOption)}
      />
    </div>
  );
}
