import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

export const toggleVariants = cva(
  'relative rounded-full border shrink-0 transition-colors duration-base ease-in-out cursor-pointer focus:outline-none',
  {
    variants: {
      checked: { true: 'bg-accent-primary border-accent-primary', false: 'bg-bg-muted border-border-muted' },
      size: { md: 'w-11 h-6' },
    },
    defaultVariants: { size: 'md' },
  }
);

export const toggleKnobVariants = cva(
  'absolute top-0.5 left-0.5 rounded-full bg-fg-primary transition-transform duration-base ease-in-out pointer-events-none',
  {
    variants: {
      checked: { true: 'translate-x-5', false: 'translate-x-0' },
      size: { md: 'w-4.5 h-4.5' },
    },
    defaultVariants: { size: 'md' },
  }
);

export type ToggleProps = VariantProps<typeof toggleVariants> & {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export default function Toggle({ id, checked, onChange, size, className }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(toggleVariants({ checked, size }), className)}
    >
      <span className={toggleKnobVariants({ checked, size })} />
    </button>
  );
}
