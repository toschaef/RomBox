import { TextInput } from '../../ui';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search"
      aria-label="Search games"
      className="w-40 md:w-56"
    />
  );
}
