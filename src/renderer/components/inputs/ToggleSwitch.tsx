type ToggleSwitchProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function ToggleSwitch({ id, checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full border shrink-0 transition-colors duration-200 ease-in-out cursor-pointer ${
        checked
          ? 'bg-accent-primary border-accent-primary'
          : 'bg-bg-muted border-border-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-fg-primary transition-transform duration-200 ease-in-out pointer-events-none ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
