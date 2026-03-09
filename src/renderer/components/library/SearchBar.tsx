interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search"
      className="
        bg-bg-secondary text-fg-primary text-sm
        border border-border-subtle rounded-none
        px-3 py-1.5 w-40 md:w-56
        placeholder:text-fg-muted
        hover:border-border-highlight
        focus:border-accent-primary focus:outline-none
        transition-colors
      "
    />
  );
}
