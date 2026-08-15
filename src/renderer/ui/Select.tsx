import { cva, type VariantProps } from 'class-variance-authority';
import type { SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export const selectVariants = cva(
  'appearance-none bg-bg-secondary text-fg-primary border border-border-subtle rounded-none cursor-pointer transition-colors hover:border-border-muted focus:outline-none focus:border-accent-primary',
  {
    variants: {
      size: {
        sm: 'pl-3 pr-8 py-1.5 text-xs font-bold',
        md: 'pl-3 pr-8 py-1.5 text-sm font-medium',
      },
    },
    defaultVariants: { size: 'md' },
  }
);

export type SelectOption = { label: string; value: string | number };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'onChange'> &
  VariantProps<typeof selectVariants> & {
    options: readonly SelectOption[];
    onChange: (value: string) => void;
    blurOnChange?: boolean;
    wrapperClassName?: string;
  };

export default function Select({
  size,
  options,
  onChange,
  blurOnChange = false,
  className,
  wrapperClassName,
  ...rest
}: SelectProps) {
  return (
    <div className={cn('relative inline-flex', wrapperClassName)}>
      <select
        className={cn(selectVariants({ size }), className)}
        onChange={(e) => {
          onChange(e.target.value);
          if (blurOnChange) e.target.blur();
        }}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-bg-secondary text-fg-primary">
            {opt.label}
          </option>
        ))}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-fg-secondary">
        {'▼'}
      </span>
    </div>
  );
}
