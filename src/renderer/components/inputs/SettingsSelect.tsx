type SettingsSelectProps = {
  id: string;
  value: string | number;
  options: readonly { label: string; value: string | number }[];
  onChange: (value: string) => void;
};

export default function SettingsSelect({ id, value, options, onChange }: SettingsSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 bg-bg-muted border border-border-muted text-fg-primary text-sm font-bold rounded-none cursor-pointer transition-colors hover:border-accent-primary focus:border-accent-primary focus:outline-none appearance-none min-w-35"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M3 5l3 3 3-3z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        paddingRight: '28px',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
